import Image from "next/image";
import type { ReactNode } from "react";
import { ShieldCheck, Globe } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const portalMode = process.env.PORTAL_MODE;
  const isAdmin = portalMode === "admin";
  const isCustomer = portalMode === "customer";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div
        className="relative hidden overflow-hidden bg-[#070a0e] lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12"
        style={{
          backgroundImage: "url('/hybrid-login.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="relative z-10 flex items-center justify-between">
          <Image
            src="/Hybrid - Logo.svg"
            alt="Hybrid Networks Logo"
            width={200}
            height={69}
          />
          {isAdmin && (
            <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 backdrop-blur-md">
              <ShieldCheck className="size-3.5" />
              <span>Admin Operations</span>
            </div>
          )}
          {isCustomer && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent-green/30 bg-accent-green/10 px-3 py-1 text-xs font-semibold text-accent-green backdrop-blur-md">
              <Globe className="size-3.5" />
              <span>Customer Portal</span>
            </div>
          )}
        </div>

        <div className="relative max-w-xl z-10">
          {isAdmin ? (
            <>
              <h2 className="mt-4 text-5xl font-extrabold leading-tight text-text-primary">
                Enterprise Network <br />&amp; Billing Operations.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-300">
                Full administrative control over customer fleets, Starlink telemetry,
                service plans, automated invoices, and system security.
              </p>
            </>
          ) : isCustomer ? (
            <>
              <h2 className="mt-4 text-5xl font-extrabold leading-tight text-text-primary">
                Monitor your network <br />&amp; billing with ease.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-300">
                Track live data usage, inspect terminal telemetry, view and pay invoices,
                and access 24/7 technical support in one place.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-5xl font-extrabold leading-tight text-text-primary">
                Run your network&apos;s <br />billing like clockwork.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-300">
                Track usage, generate invoices, and manage every customer across
                Starlink, Fiber, and VSAT connections from a single dashboard.
              </p>
            </>
          )}
          <p className="mt-16 relative z-10 text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Hybrid Networks. {isAdmin ? "Internal Operations Portal." : "All rights reserved."}
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Image
              src="/Hybrid - Logo.svg"
              alt="Hybrid Networks Logo"
              width={104}
              height={36}
            />
            {isAdmin && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400">
                Admin
              </span>
            )}
            {isCustomer && (
              <span className="rounded-full border border-accent-green/30 bg-accent-green/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-green">
                Customer
              </span>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
