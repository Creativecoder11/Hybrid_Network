import "server-only";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { CustomerAccount, normalizeAccountNumber, type CustomerAccountStatus } from "@/models/CustomerAccount";
import { CdrIdentifierMapping } from "@/models/CdrIdentifierMapping";
import type { PricingMethod } from "@/models/RetailPlan";
import {
  UNALLOCATED_REASON_LABELS,
  type ProductType,
  type UnallocatedReasonCode,
} from "@/models/cdrAllocation";

// CDR allocation, shared by both CDR pipelines.
//
//   CDR row ── Customer Code ──> Customer Account (CustomerAccount.accountNumber)
//          └─ Product Code ───> Product (CdrIdentifierMapping, active)
//
// A row is ALLOCATED only when both resolve and the combination is valid.
// Otherwise it is UNALLOCATED with a reason code, stored for the report and
// admin follow-up. Nothing here ever creates a customer, account or product.
//
// Customer Codes are matched case-insensitively. ICCID / card name are used
// only when the row has no customer code at all (older ICCID-keyed exports);
// a row whose customer code is present but unknown is never re-routed to a
// different account by ICCID.

export type AccountRef = {
  id: Types.ObjectId;
  customerId: Types.ObjectId;
  accountNumber: string;
  status: CustomerAccountStatus;
  allowedProductCodes: Set<string>;
};

export type ProductPlan = {
  _id: Types.ObjectId;
  name: string;
  pricingMethod: PricingMethod;
  markupPercent: number;
  fixedPrice: number;
  currency: string;
};

export type ProductRef = {
  id: Types.ObjectId;
  code: string;
  name: string;
  productType: ProductType;
  isActive: boolean;
  /** Active pricing rule, or null when the product has none. */
  retailPlan: ProductPlan | null;
};

export type AllocationContext = {
  accountsByNumber: Map<string, AccountRef>;
  accountsByIccid: Map<string, AccountRef>;
  accountsByCardName: Map<string, AccountRef>;
  productsByCode: Map<string, ProductRef>;
};

export function normalizeProductCode(code: string | null | undefined): string {
  return String(code ?? "").trim().toLowerCase();
}

export async function buildAllocationContext(): Promise<AllocationContext> {
  await connectDB();
  const [accounts, mappings] = await Promise.all([
    CustomerAccount.find().select("customer accountNumber status allowedProductCodes iccids cardName").lean(),
    CdrIdentifierMapping.find().populate("retailPlan").sort({ isActive: -1, updatedAt: -1 }).lean(),
  ]);

  const accountsByNumber = new Map<string, AccountRef>();
  const accountsByIccid = new Map<string, AccountRef>();
  const accountsByCardName = new Map<string, AccountRef>();
  for (const a of accounts) {
    const ref: AccountRef = {
      id: a._id,
      customerId: a.customer,
      accountNumber: a.accountNumber,
      status: a.status ?? "ACTIVE",
      allowedProductCodes: new Set((a.allowedProductCodes ?? []).map(normalizeProductCode).filter(Boolean)),
    };
    accountsByNumber.set(normalizeAccountNumber(a.accountNumber), ref);
    for (const iccid of a.iccids ?? []) {
      if (iccid?.trim()) accountsByIccid.set(iccid.trim().toUpperCase(), ref);
    }
    if (a.cardName?.trim()) accountsByCardName.set(a.cardName.trim().toUpperCase(), ref);
  }

  // Sorted active-first, so the first mapping seen for a code is the one in
  // force; a code with only inactive mappings resolves to an inactive product.
  const productsByCode = new Map<string, ProductRef>();
  for (const m of mappings) {
    const key = normalizeProductCode(m.identifier);
    if (!key || productsByCode.has(key)) continue;
    const plan = m.retailPlan as unknown as (ProductPlan & { isActive?: boolean }) | null;
    productsByCode.set(key, {
      id: m._id,
      code: m.identifier,
      name: m.name || m.identifier,
      productType: (m.productType ?? "OTHER") as ProductType,
      isActive: Boolean(m.isActive),
      retailPlan: plan && plan.isActive !== false ? plan : null,
    });
  }

  return { accountsByNumber, accountsByIccid, accountsByCardName, productsByCode };
}

/** Maps a CDR row's free-text type to a product type when it is unambiguous. */
export function normalizeRecordType(raw: string | null | undefined): ProductType | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!v) return null;
  if (v === "CALL" || v === "VOICE" || v === "VOICE CALL") return "CALL";
  if (v === "SMS" || v === "TEXT" || v === "MESSAGE") return "SMS";
  if (v === "DATA") return "DATA";
  return null;
}

export type AllocationInput = {
  customerCode: string;
  productCode: string;
  recordType?: string;
  iccid?: string;
  cardName?: string;
  /** Retail pricing import: the product must also have an active pricing rule. */
  requirePricing: boolean;
  /** Admin manual resolution: allocate to this account instead of looking one up. */
  forcedAccount?: AccountRef | null;
};

export type AllocationResult =
  | { status: "ALLOCATED"; account: AccountRef; product: ProductRef }
  | {
      status: "UNALLOCATED";
      reasonCode: UnallocatedReasonCode;
      reason: string;
      account: AccountRef | null;
      product: ProductRef | null;
    };

function resolveAccount(ctx: AllocationContext, input: AllocationInput): { account: AccountRef | null; problem: [UnallocatedReasonCode, string] | null } {
  if (input.forcedAccount) return { account: input.forcedAccount, problem: null };
  const code = input.customerCode.trim();
  if (code) {
    const account = ctx.accountsByNumber.get(normalizeAccountNumber(code)) ?? null;
    return account
      ? { account, problem: null }
      : { account: null, problem: ["CUSTOMER_ACCOUNT_NOT_FOUND", `No Customer Account with account number "${code}".`] };
  }
  const byIccid = input.iccid?.trim() ? ctx.accountsByIccid.get(input.iccid.trim().toUpperCase()) : undefined;
  const byCard = input.cardName?.trim() ? ctx.accountsByCardName.get(input.cardName.trim().toUpperCase()) : undefined;
  const account = byIccid ?? byCard ?? null;
  return account
    ? { account, problem: null }
    : { account: null, problem: ["CUSTOMER_CODE_MISSING", "The record has no Customer Code (and no known ICCID / card name)."] };
}

export function allocateRow(ctx: AllocationContext, input: AllocationInput): AllocationResult {
  const problems: [UnallocatedReasonCode, string][] = [];

  const { account, problem: accountProblem } = resolveAccount(ctx, input);
  if (accountProblem) problems.push(accountProblem);
  if (account?.status === "CLOSED") {
    problems.push(["CUSTOMER_ACCOUNT_CLOSED", `Customer Account "${account.accountNumber}" is closed.`]);
  }

  const productKey = normalizeProductCode(input.productCode);
  const product = productKey ? (ctx.productsByCode.get(productKey) ?? null) : null;
  if (!productKey) {
    problems.push(["PRODUCT_CODE_MISSING", "The record has no Product Code."]);
  } else if (!product) {
    problems.push(["PRODUCT_CODE_NOT_FOUND", `Product Code "${input.productCode.trim()}" is not in the Product Code list.`]);
  } else {
    if (!product.isActive) {
      problems.push(["PRODUCT_INACTIVE", `Product Code "${product.code}" is inactive.`]);
    }
    const rowType = normalizeRecordType(input.recordType);
    const typed = product.productType === "CALL" || product.productType === "SMS" || product.productType === "DATA";
    if (rowType && typed && rowType !== product.productType) {
      problems.push([
        "PRODUCT_TYPE_MISMATCH",
        `Record type "${input.recordType?.trim()}" does not match Product Code "${product.code}" (${product.productType}).`,
      ]);
    }
    if (account && account.allowedProductCodes.size > 0 && !account.allowedProductCodes.has(productKey)) {
      problems.push([
        "PRODUCT_NOT_ALLOWED_FOR_ACCOUNT",
        `Product Code "${product.code}" is not enabled for Customer Account "${account.accountNumber}".`,
      ]);
    }
    if (input.requirePricing && product.isActive && !product.retailPlan) {
      problems.push(["PRODUCT_HAS_NO_PRICING", `Product Code "${product.code}" has no active Retail Plan for pricing.`]);
    }
  }

  if (problems.length === 0 && account && product) {
    return { status: "ALLOCATED", account, product };
  }
  return {
    status: "UNALLOCATED",
    reasonCode: problems[0][0],
    reason: problems.map((p) => p[1]).join(" "),
    account,
    product,
  };
}

export function reasonLabel(code: string | null | undefined): string {
  return code && code in UNALLOCATED_REASON_LABELS
    ? UNALLOCATED_REASON_LABELS[code as UnallocatedReasonCode]
    : "Unallocated";
}
