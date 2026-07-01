/**
 * Error reporting utility.
 * Currently a safe no-op stub (logs in dev only).
 * Replace with Sentry, LogRocket, or any error tracking service for production.
 */

type ErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

export function reportError(error: unknown, context: Record<string, unknown> = {}, options?: ErrorOptions) {
  if (process.env.NODE_ENV === "development") {
    console.error("[Error]", error, context);
  }
}

// Backward-compatible alias
export const reportLovableError = reportError;
