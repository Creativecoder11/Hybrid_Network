import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-[#070a0e] lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 15%, rgba(74,222,128,0.16), transparent 45%), radial-gradient(circle at 80% 75%, rgba(59,130,246,0.20), transparent 50%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(#232A33 1px, transparent 1px), linear-gradient(90deg, #232A33 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-green/15 text-sm font-bold text-accent-green">
            HN
          </span>
          <span className="text-sm font-bold tracking-wide text-text-primary">HYBRID NETWORKS</span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            ISP Distributor Portal
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-text-primary">
            Run your network&apos;s billing like clockwork.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            Track usage, generate invoices, and manage every customer across Starlink,
            Fiber, and VSAT connections from a single dashboard.
          </p>
        </div>

        <p className="relative z-10 text-xs text-text-muted">
          &copy; {new Date().getFullYear()} Hybrid Networks. All rights reserved.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent-green/15 text-sm font-bold text-accent-green">
              HN
            </span>
            <span className="text-sm font-bold tracking-wide text-text-primary">HYBRID NETWORKS</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
