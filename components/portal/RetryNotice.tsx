"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Inline error with a Retry button that re-runs the page's server data loading. */
export function RetryNotice({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber/30 bg-amber/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-amber">
        <AlertTriangle className="size-4 shrink-0" />
        {message}
      </p>
      <Button size="sm" variant="outline" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}
