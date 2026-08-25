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
            height={69}
          />
        </div>

        <div className="relative max-w-xl z-10">
          
          <h2 className="mt-4 text-6xl font-extrabold leading-tight text-text-primary">
            Run your network&apos;s <br/>billing like clockwork.
          </h2>
          <p className="mt-4 text-lg leading-relaxed">
            Track usage, generate invoices, and manage every customer across
            Starlink, Fiber, and VSAT connections from a single dashboard.
          </p>
          <p className="mt-20 relative z-10 text-xs text-text-muted">
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
              width={104}
              height={36}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
