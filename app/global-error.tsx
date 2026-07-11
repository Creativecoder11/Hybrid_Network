"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#0B0F14",
          color: "#F3F4F6",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, color: "#9CA3AF", fontSize: 14, maxWidth: 380 }}>
          A critical error occurred while loading Hybrid Networks Portal.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            borderRadius: 12,
            background: "#3B82F6",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
