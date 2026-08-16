import { z } from "zod";

export const cdrIdentifierMappingSchema = z.object({
  id: z.string().optional(),
  identifier: z.string().min(1, "Identifier is required").trim(),
  retailPlanId: z.string().min(1, "Choose a Retail Plan"),
  isActive: z.boolean().default(true),
});
export type CdrIdentifierMappingInput = z.infer<typeof cdrIdentifierMappingSchema>;
