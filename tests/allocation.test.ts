import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { allocateRow, normalizeRecordType, type AccountRef, type AllocationContext, type ProductRef } from "@/lib/cdr/allocation";

// CDR allocation rules: Customer Code -> Customer Account, Product Code ->
// Product, plus the combination checks. Pure function, no database.

function account(num: string, opts: Partial<AccountRef> = {}): AccountRef {
  return {
    id: new Types.ObjectId(),
    customerId: new Types.ObjectId(),
    accountNumber: num,
    status: "ACTIVE",
    allowedProductCodes: new Set(),
    ...opts,
  };
}

function product(code: string, opts: Partial<ProductRef> = {}): ProductRef {
  return {
    id: new Types.ObjectId(),
    code,
    name: code,
    productType: "OTHER",
    isActive: true,
    retailPlan: {
      _id: new Types.ObjectId(),
      name: "Standard",
      pricingMethod: "PERCENTAGE_MARKUP",
      markupPercent: 50,
      fixedPrice: 0,
      currency: "USD",
    },
    ...opts,
  };
}

function ctx(accounts: AccountRef[], products: ProductRef[], iccids: Record<string, AccountRef> = {}): AllocationContext {
  return {
    accountsByNumber: new Map(accounts.map((a) => [a.accountNumber.toUpperCase(), a])),
    accountsByIccid: new Map(Object.entries(iccids)),
    accountsByCardName: new Map(),
    productsByCode: new Map(products.map((p) => [p.code.toLowerCase(), p])),
  };
}

const A10001 = account("10001");
const A10002 = account("10002");
const CLOSED = account("99999", { status: "CLOSED" });
const RESTRICTED = account("20001", { allowedProductCodes: new Set(["300"]) });
const CALL = product("123", { productType: "CALL" });
const SMS = product("245", { productType: "SMS" });
const DATA = product("300", { productType: "DATA" });
const INACTIVE = product("777", { isActive: false });
const NO_PRICE = product("888", { retailPlan: null });
const C = ctx([A10001, A10002, CLOSED, RESTRICTED], [CALL, SMS, DATA, INACTIVE, NO_PRICE], { KIT123: A10002 });

const base = { requirePricing: false };

test("valid customer code + product code is allocated to that account", () => {
  const r = allocateRow(C, { ...base, customerCode: "10001", productCode: "123" });
  assert.equal(r.status, "ALLOCATED");
  if (r.status === "ALLOCATED") {
    assert.equal(r.account.accountNumber, "10001");
    assert.equal(r.product.code, "123");
  }
});

test("customer code and product code match case-insensitively and ignore whitespace", () => {
  const acc = account("ZZSP100");
  const prod = product("Starlink");
  const r = allocateRow(ctx([acc], [prod]), { ...base, customerCode: " zzsp100 ", productCode: "STARLINK " });
  assert.equal(r.status, "ALLOCATED");
});

test("bulk file: each row goes to its own account", () => {
  const rows = ["10001", "10002", "10001", "10002"].map((code) => allocateRow(C, { ...base, customerCode: code, productCode: "245" }));
  assert.deepEqual(
    rows.map((r) => (r.status === "ALLOCATED" ? r.account.accountNumber : r.status)),
    ["10001", "10002", "10001", "10002"]
  );
});

test("unknown customer code is unallocated — never auto-created", () => {
  const r = allocateRow(C, { ...base, customerCode: "55555", productCode: "123" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") {
    assert.equal(r.reasonCode, "CUSTOMER_ACCOUNT_NOT_FOUND");
    assert.equal(r.account, null);
  }
});

test("unknown product code is unallocated", () => {
  const r = allocateRow(C, { ...base, customerCode: "10001", productCode: "999" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "PRODUCT_CODE_NOT_FOUND");
});

test("customer matches but product is inactive -> unallocated", () => {
  const r = allocateRow(C, { ...base, customerCode: "10001", productCode: "777" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "PRODUCT_INACTIVE");
});

test("record type that contradicts the product type -> unallocated (invalid combination)", () => {
  const r = allocateRow(C, { ...base, customerCode: "10001", productCode: "123", recordType: "SMS" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "PRODUCT_TYPE_MISMATCH");
  const ok = allocateRow(C, { ...base, customerCode: "10001", productCode: "123", recordType: "Voice" });
  assert.equal(ok.status, "ALLOCATED");
});

test("product not enabled for a restricted account -> unallocated", () => {
  const bad = allocateRow(C, { ...base, customerCode: "20001", productCode: "123" });
  assert.equal(bad.status, "UNALLOCATED");
  if (bad.status === "UNALLOCATED") assert.equal(bad.reasonCode, "PRODUCT_NOT_ALLOWED_FOR_ACCOUNT");
  assert.equal(allocateRow(C, { ...base, customerCode: "20001", productCode: "300" }).status, "ALLOCATED");
});

test("closed account -> unallocated", () => {
  const r = allocateRow(C, { ...base, customerCode: "99999", productCode: "123" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "CUSTOMER_ACCOUNT_CLOSED");
});

test("both codes wrong: first reason is the account, reason text lists both", () => {
  const r = allocateRow(C, { ...base, customerCode: "55555", productCode: "999" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") {
    assert.equal(r.reasonCode, "CUSTOMER_ACCOUNT_NOT_FOUND");
    assert.match(r.reason, /55555/);
    assert.match(r.reason, /999/);
  }
});

test("retail pricing requires a pricing rule on the product", () => {
  const r = allocateRow(C, { customerCode: "10001", productCode: "888", requirePricing: true });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "PRODUCT_HAS_NO_PRICING");
  assert.equal(allocateRow(C, { customerCode: "10001", productCode: "888", requirePricing: false }).status, "ALLOCATED");
});

test("ICCID fallback only when the row has no customer code", () => {
  const byIccid = allocateRow(C, { ...base, customerCode: "", productCode: "123", iccid: "KIT123" });
  assert.equal(byIccid.status, "ALLOCATED");
  if (byIccid.status === "ALLOCATED") assert.equal(byIccid.account.accountNumber, "10002");

  // A present-but-unknown customer code must NOT be re-routed by ICCID.
  const wrongCode = allocateRow(C, { ...base, customerCode: "55555", productCode: "123", iccid: "KIT123" });
  assert.equal(wrongCode.status, "UNALLOCATED");
});

test("missing customer code and no ICCID -> CUSTOMER_CODE_MISSING", () => {
  const r = allocateRow(C, { ...base, customerCode: "", productCode: "123" });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "CUSTOMER_CODE_MISSING");
});

test("missing product code -> PRODUCT_CODE_MISSING", () => {
  const r = allocateRow(C, { ...base, customerCode: "10001", productCode: "  " });
  assert.equal(r.status, "UNALLOCATED");
  if (r.status === "UNALLOCATED") assert.equal(r.reasonCode, "PRODUCT_CODE_MISSING");
});

test("admin manual allocation forces the account but still validates the product", () => {
  const forced = allocateRow(C, { ...base, customerCode: "55555", productCode: "123", forcedAccount: A10002 });
  assert.equal(forced.status, "ALLOCATED");
  const stillBad = allocateRow(C, { ...base, customerCode: "55555", productCode: "999", forcedAccount: A10002 });
  assert.equal(stillBad.status, "UNALLOCATED");
});

test("record type normalization only maps unambiguous values", () => {
  assert.equal(normalizeRecordType("call"), "CALL");
  assert.equal(normalizeRecordType("VOICE"), "CALL");
  assert.equal(normalizeRecordType("sms"), "SMS");
  assert.equal(normalizeRecordType("Data"), "DATA");
  assert.equal(normalizeRecordType("Background IP"), null);
  assert.equal(normalizeRecordType(""), null);
});
