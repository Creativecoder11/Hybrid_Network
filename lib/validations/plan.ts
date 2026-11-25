import { z } from "zod";
import { PLAN_TYPES } from "@/models/ServicePlan";
import { PLAN_PROVIDER_MAX_LENGTH } from "@/lib/plans/providers";

export const servicePlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Plan name is required"),
  provider: z
    .string()
    .trim()
    .min(1, "Provider is required")
    .max(PLAN_PROVIDER_MAX_LENGTH, `Provider name must be ${PLAN_PROVIDER_MAX_LENGTH} characters or fewer`),
  planType: z.enum(PLAN_TYPES).default("DATA"),
  monthlyPrice: z.coerce.number().min(0),
  currency: z.string().default("USD"),
  dataAllowanceGB: z.coerce.number().min(0).nullable().optional(),
  voiceMinutes: z.coerce.number().min(0).nullable().optional(),
  smsCount: z.coerce.number().min(0).nullable().optional(),
  overageRatePerGB: z.coerce.number().min(0).default(0),
  overageRatePerMin: z.coerce.number().min(0).default(0),
  speedMbps: z.coerce.number().min(0).nullable().optional(),
  sharedRatio: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});
export type ServicePlanInput = z.infer<typeof servicePlanSchema>;
