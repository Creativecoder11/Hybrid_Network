"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-red/15 text-red">
        <AlertTriangle className="size-6" />
      </div>
      <p className="mt-5 text-2xl font-bold text-text-primary">Something went wrong</p>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        An unexpected error occurred. You can try again, or head back to safety.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-raised"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-accent-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-blue-strong"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
