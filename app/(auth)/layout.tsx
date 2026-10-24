import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const portalMode = process.env.PORTAL_MODE as "admin" | "customer" | undefined;
  const isCustomer = portalMode === "customer";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden overflow-hidden bg-[#070a0e] lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/hybrid-login.jpg"
          className="absolute inset-0 size-full object-cover"
        >
          <source
            src="https://hybridnetworks.net.au/wp-content/uploads/2026/05/Hybrid-network-Banner-Video_1080p.mp4"
            type="video/mp4"
          />
        </video>

        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-[#070a0e]/70" />
        <div className="relative z-10 flex items-center gap-2">
          <Image
            src={isCustomer ? "/athena-logo.png" : "/Hybrid - Logo.svg"}
            alt={isCustomer ? "Athena - Hybrid Networks" : "Hybrid Networks Logo"}
            width={isCustomer ? 180 : 200}
            height={isCustomer ? 180 : 209}
            className={isCustomer ? "h-30 w-auto object-contain" : ""}
            priority
          />
        </div>

        <div className="relative max-w-xl z-10">
          <h2 className="mt-4 text-6xl font-extrabold leading-tight text-text-primary">
            {isCustomer ? (
              <>
                One window. <br />
                Complete visibility.
              </>
            ) : (
              <>
                Run your network&apos;s <br />
                billing like clockwork.
              </>
            )}
          </h2>
          <p className="mt-4 text-lg leading-relaxed">
            {isCustomer
              ? "Access your real-time terminal telemetry, track data usage, manage service plans, and view invoices in one seamless portal."
              : "Track usage, generate invoices, and manage every customer across Starlink, Fiber, and VSAT connections from a single dashboard."}
          </p>
          <p className="mt-20 relative z-10 text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Hybrid Networks. All rights
            reserved.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">
          {!isCustomer && (
            <div className="mb-8 flex items-center gap-2 lg:hidden">
              <Image
                src="/Hybrid - Logo.svg"
                alt="Hybrid Networks Logo"
                width={104}
                height={36}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
