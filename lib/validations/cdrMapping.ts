import { z } from "zod";
import { PRODUCT_TYPES } from "@/models/cdrAllocation";

// A Product Code entry (CdrIdentifierMapping). The Retail Plan is optional:
// without one the code still validates CDR allocation, but retail pricing
// imports report its records as "Product has no pricing rule".
export const cdrIdentifierMappingSchema = z.object({
  id: z.string().optional(),
  identifier: z
    .string()
    .trim()
    .min(1, "Product Code is required")
    .max(64, "Product Code is too long"),
  name: z.string().trim().min(1, "Product name is required").max(120),
  productType: z.enum(PRODUCT_TYPES),
  category: z.string().trim().max(60).optional().default(""),
  description: z.string().trim().max(500).optional().default(""),
  retailPlanId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CdrIdentifierMappingInput = z.infer<typeof cdrIdentifierMappingSchema>;
