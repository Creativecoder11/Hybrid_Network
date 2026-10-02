import Link from "next/link";
import { ArrowLeft, Satellite } from "lucide-react";

export default function DeviceNotFound() {
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/portal/devices"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to My Devices
      </Link>
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-raised text-text-muted">
          <Satellite className="size-6 text-accent-green" />
        </div>
        <p className="mt-4 text-lg font-semibold text-text-primary">Device Not Found</p>
        <p className="mt-1 text-sm text-text-muted">
          This device could not be found or is not associated with your current customer account.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/portal/devices"
            className="inline-flex items-center justify-center rounded-xl bg-accent-blue px-4 py-2 text-xs font-medium text-white hover:bg-accent-blue-strong"
          >
            Back to My Devices
          </Link>
        </div>
      </div>
    </div>
  );
}
