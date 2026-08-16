import type { PricingMethod } from "@/models/RetailPlan";
export type { PricingMethod };

export type RetailPlanRow = {
  id: string;
  name: string;
  description: string;
  pricingMethod: PricingMethod;
  markupPercent: number;
  fixedPrice: number;
  currency: string;
  isActive: boolean;
  mappedIdentifierCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CdrIdentifierMappingRow = {
  id: string;
  identifier: string;
  retailPlanId: string;
  retailPlanName: string;
  retailPlanActive: boolean;
  pricingMethod: PricingMethod;
  pricingValueLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CdrImportBatchRow = {
  id: string;
  fileName: string;
  uploadedByName: string;
  identifierColumn: string;
  wholesaleColumn: string;
  totalRows: number;
  processedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  invalidRows: number;
  totalWholesaleAmount: number;
  totalRetailAmount: number;
  currency: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  errorLog: string[];
  createdAt: string;
};

export type CdrChargeRecordRow = {
  id: string;
  rowNumber: number;
  identifier: string;
  description: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  wholesaleAmount: number;
  currency: string;
  retailPlanName: string;
  pricingMethodUsed: PricingMethod | null;
  markupPercentUsed: number | null;
  fixedPriceUsed: number | null;
  retailAmount: number;
  status: "MATCHED" | "UNMATCHED" | "INVALID";
  errorReason: string;
  invoiceId: string | null;
  createdAt: string;
};
