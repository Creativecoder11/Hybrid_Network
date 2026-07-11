import "server-only";

const GB = 1_000_000_000;

export type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};

export function computeInvoiceLineItems(params: {
  planName: string;
  monthlyPrice: number;
  dataAllowanceGB: number | null;
  voiceMinutes: number | null;
  overageRatePerGB: number;
  overageRatePerMin: number;
  usedDataBytes: number;
  usedVoiceMin: number;
  extraLineItems: { description: string; quantity: number; unit: string; unitPrice: number }[];
}): { lineItems: LineItem[]; subtotal: number } {
  const lineItems: LineItem[] = [
    {
      description: `${params.planName} — Monthly Subscription`,
      quantity: 1,
      unit: "month",
      unitPrice: params.monthlyPrice,
      amount: params.monthlyPrice,
    },
  ];

  if (params.dataAllowanceGB !== null) {
    const usedGB = params.usedDataBytes / GB;
    const overageGB = Math.max(0, usedGB - params.dataAllowanceGB);
    if (overageGB > 0.001 && params.overageRatePerGB > 0) {
      const amount = Math.round(overageGB * params.overageRatePerGB * 100) / 100;
      lineItems.push({
        description: `Data Overage (${overageGB.toFixed(2)} GB over ${params.dataAllowanceGB} GB allowance)`,
        quantity: Math.round(overageGB * 100) / 100,
        unit: "GB",
        unitPrice: params.overageRatePerGB,
        amount,
      });
    }
  }

  if (params.voiceMinutes !== null) {
    const overageMin = Math.max(0, params.usedVoiceMin - params.voiceMinutes);
    if (overageMin > 0 && params.overageRatePerMin > 0) {
      const amount = Math.round(overageMin * params.overageRatePerMin * 100) / 100;
      lineItems.push({
        description: `Voice Overage (${overageMin} min over ${params.voiceMinutes} min allowance)`,
        quantity: overageMin,
        unit: "min",
        unitPrice: params.overageRatePerMin,
        amount,
      });
    }
  }

  for (const extra of params.extraLineItems) {
    if (!extra.description) continue;
    const amount = Math.round(extra.quantity * extra.unitPrice * 100) / 100;
    lineItems.push({ ...extra, amount });
  }

  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.amount, 0) * 100) / 100;
  return { lineItems, subtotal };
}
