export type PlanFull = {
  id: string;
  name: string;
  provider: string;
  planType: "DATA" | "VOICE" | "HYBRID";
  monthlyPrice: number;
  currency: string;
  dataAllowanceGB: number | null;
  voiceMinutes: number | null;
  smsCount: number | null;
  overageRatePerGB: number;
  overageRatePerMin: number;
  speedMbps: number | null;
  sharedRatio: string;
  isActive: boolean;
  subscriberCount: number;
};
