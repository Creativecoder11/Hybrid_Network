import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hybrid Networks Portal",
  description: "ISP distributor billing, usage-tracking, and customer-management platform.",
  icons: {
    icon: "/favicon.png",
  },
};

// Render every page at request time (no build-time prerendering). Two reasons:
// 1. The hosting CDN honours the `s-maxage=31536000` header Next sends for
//    prerendered HTML, so after a redeploy it kept serving the previous
//    build's /login HTML, which points at JS chunks the new build no longer
//    ships -> ChunkLoadError -> the "Something went wrong" error boundary.
//    Dynamic pages are sent with `no-store`, so nothing upstream can hold on
//    to stale HTML across deploys.
// 2. PORTAL_MODE / ADMIN_PORTAL_URL / CUSTOMER_PORTAL_URL are set in the
//    hosting panel, not in the shell that runs `npm run build`. Reading them
//    per request (instead of baking them into a prerender) is what the
//    deployment docs already assume.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <body className="min-h-screen bg-bg text-text-primary antialiased" suppressHydrationWarning>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#161B22",
              border: "1px solid #232A33",
              color: "#F3F4F6",
            },
          }}
        />
      </body>
    </html>
  );
}
