// Shared vocabulary for CDR allocation, used by both CDR pipelines (the
// usage-rated upload -> CdrRecord and the retail pricing import ->
// CdrChargeRecord) and by the unallocated reports.

export const PRODUCT_TYPES = ["CALL", "SMS", "DATA", "SERVICE", "OTHER"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const UNALLOCATED_REASON_CODES = [
  "CUSTOMER_CODE_MISSING",
  "CUSTOMER_ACCOUNT_NOT_FOUND",
  "CUSTOMER_ACCOUNT_CLOSED",
  "PRODUCT_CODE_MISSING",
  "PRODUCT_CODE_NOT_FOUND",
  "PRODUCT_INACTIVE",
  "PRODUCT_TYPE_MISMATCH",
  "PRODUCT_NOT_ALLOWED_FOR_ACCOUNT",
  "PRODUCT_HAS_NO_PRICING",
] as const;
export type UnallocatedReasonCode = (typeof UNALLOCATED_REASON_CODES)[number];

export const UNALLOCATED_REASON_LABELS: Record<UnallocatedReasonCode, string> = {
  CUSTOMER_CODE_MISSING: "Customer Code missing",
  CUSTOMER_ACCOUNT_NOT_FOUND: "Customer Account not found",
  CUSTOMER_ACCOUNT_CLOSED: "Customer Account closed",
  PRODUCT_CODE_MISSING: "Product Code missing",
  PRODUCT_CODE_NOT_FOUND: "Product Code not found",
  PRODUCT_INACTIVE: "Product Code inactive",
  PRODUCT_TYPE_MISMATCH: "Record type does not match Product type",
  PRODUCT_NOT_ALLOWED_FOR_ACCOUNT: "Product not enabled for this Customer Account",
  PRODUCT_HAS_NO_PRICING: "Product has no active pricing rule (Retail Plan)",
};
