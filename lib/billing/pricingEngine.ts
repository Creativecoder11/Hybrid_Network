import type { PricingMethod } from "@/models/RetailPlan";
import { toCents, fromCents } from "./money";

export type PricingRule = {
  pricingMethod: PricingMethod;
  markupPercent: number;
  fixedPrice: number;
};

export type PricingResult = {
  wholesaleAmount: number;
  retailAmount: number;
  markupAmount: number;
  pricingMethod: PricingMethod;
  markupPercentUsed: number | null;
  fixedPriceUsed: number | null;
};

/**
 * Central wholesale -> retail pricing calculation. Shared by CDR import
 * processing and invoice generation so both stay in agreement — per-record
 * results are snapshotted (see CdrChargeRecord) so edits to a Retail Plan
 * never retroactively change an already-priced record.
 */
export function calculateRetailCharge(wholesaleAmount: number, rule: PricingRule): PricingResult {
  const wholesaleCents = toCents(wholesaleAmount);

  if (rule.pricingMethod === "FIXED_PRICE") {
    const retailCents = toCents(rule.fixedPrice);
    return {
      wholesaleAmount: fromCents(wholesaleCents),
      retailAmount: fromCents(retailCents),
      markupAmount: fromCents(retailCents - wholesaleCents),
      pricingMethod: "FIXED_PRICE",
      markupPercentUsed: null,
      fixedPriceUsed: fromCents(retailCents),
    };
  }

  // PERCENTAGE_MARKUP: Retail = Wholesale + (Wholesale x Markup%)
  const markupCents = Math.round((wholesaleCents * rule.markupPercent) / 100);
  const retailCents = wholesaleCents + markupCents;
  return {
    wholesaleAmount: fromCents(wholesaleCents),
    retailAmount: fromCents(retailCents),
    markupAmount: fromCents(markupCents),
    pricingMethod: "PERCENTAGE_MARKUP",
    markupPercentUsed: rule.markupPercent,
    fixedPriceUsed: null,
  };
}
