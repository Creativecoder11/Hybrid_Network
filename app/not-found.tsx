import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-raised text-text-muted">
        <SearchX className="size-6" />
      </div>
      <p className="mt-5 text-2xl font-bold text-text-primary">Page not found</p>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-blue-strong"
      >
        Go back home
      </Link>
    </div>
  );
}
