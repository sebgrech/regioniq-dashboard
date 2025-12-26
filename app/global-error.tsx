"use client"

/**
 * Global Error Handler
 * 
 * Catches errors in the root layout that error.tsx cannot catch.
 * This is the last line of defense for unhandled errors.
 */

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error for debugging (could send to error tracking service)
    console.error("Global application error:", error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#0a0a0a",
            color: "#fafafa",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              textAlign: "center",
              padding: "2rem",
              borderRadius: "0.75rem",
              border: "1px solid #27272a",
              background: "#18181b",
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "3rem",
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Application Error
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
              Something went wrong. This has been logged and we&apos;ll look into it.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#3b82f6",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #3f3f46",
                  background: "transparent",
                  color: "#fafafa",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Go Home
              </button>
            </div>

            {error.digest && (
              <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#71717a" }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}

