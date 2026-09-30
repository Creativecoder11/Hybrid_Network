import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generateDueRecurringInvoices } from "@/lib/billing/recurring";

// Daily trigger for recurring invoices, meant for a Hostinger cron job:
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<admin-domain>/api/cron/recurring-invoices
// Disabled until CRON_SECRET is set. Only creates DRAFT invoices, and is safe
// to call repeatedly (see lib/billing/recurring.ts).

export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, error: "Recurring invoice generation is disabled (CRON_SECRET not set)." }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 401 });
  }

  const run = await generateDueRecurringInvoices();
  return NextResponse.json(
    {
      success: run.failed.length === 0,
      created: run.created.map((c) => c.invoiceNumber),
      failed: run.failed.length,
    },
    { status: run.failed.length === 0 ? 200 : 500 }
  );
}

export const GET = handle;
export const POST = handle;
