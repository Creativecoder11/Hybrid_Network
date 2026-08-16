import { z } from "zod";
import { PRICING_METHODS } from "@/models/RetailPlan";

export const retailPlanSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(2, "Plan name is required"),
    description: z.string().optional().default(""),
    pricingMethod: z.enum(PRICING_METHODS),
    markupPercent: z.coerce.number().min(0, "Markup can't be negative").max(1000).default(50),
    fixedPrice: z.coerce.number().min(0, "Fixed price can't be negative").default(0),
    currency: z.string().min(1).default("USD"),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.pricingMethod !== "FIXED_PRICE" || data.fixedPrice > 0, {
    message: "Fixed retail price must be greater than 0",
    path: ["fixedPrice"],
  });
export type RetailPlanInput = z.infer<typeof retailPlanSchema>;
