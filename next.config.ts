import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdfkit (used by @react-pdf/renderer for invoice PDFs) loads its built-in
  // fonts through package "imports" aliases (`#standard-fonts/Helvetica`),
  // which Next's file tracing can't follow. Hosts that deploy only the traced
  // files (Hostinger's hbuilds) then fail every PDF with "Cannot find module
  // .../pdfkit/js/standard-fonts/Helvetica.cjs". PDFs are rendered from the
  // PDF route, server actions and the recurring-invoice timer, so include the
  // files for every route.
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
      // Read with fs at render time (lib/billing/invoiceData.ts), so also untraced.
      "./public/assets/hybrid-logo-invoice.png",
    ],
  },
};

export default nextConfig;
