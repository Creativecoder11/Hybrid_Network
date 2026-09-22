"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Portal-level error boundary: keeps the navigation shell and offers a retry
// instead of replacing the whole screen.
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red/15 text-red">
        <AlertTriangle className="size-5" />
      </div>
      <p className="mt-4 text-lg font-semibold text-text-primary">Unable to load this page</p>
      <p className="mt-1 max-w-sm text-sm text-text-muted">Something went wrong while loading your information. Please try again.</p>
      <Button className="mt-5" variant="outline" onClick={reset}>
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
