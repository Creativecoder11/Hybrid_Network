import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
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
        <div className="relative z-10 flex items-center gap-2">
          <Image
            src="/Hybrid - Logo.svg"
            alt="Hybrid Networks Logo"
            width={200}
            height={50}
          />
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            ISP Distributor Portal
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-text-primary">
            Run your network&apos;s billing like clockwork.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            Track usage, generate invoices, and manage every customer across
            Starlink, Fiber, and VSAT connections from a single dashboard.
          </p>
          <p className="relative z-10 text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Hybrid Networks. All rights
            reserved.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Image
              src="/Hybrid - Logo.svg"
              alt="Hybrid Networks Logo"
              width={36}
              height={36}
            />
            <span className="text-sm font-bold tracking-wide text-text-primary">
              HYBRID NETWORKS
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
