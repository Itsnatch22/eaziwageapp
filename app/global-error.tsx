"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Only fires when the root layout itself throws — app/error.tsx (which
// already reports to Sentry too) handles every other route-segment error.
// This one has to render its own <html>/<body> since the root layout that
// would normally provide them is what crashed.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem', color: '#0f172a' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '28rem' }}>
            We&apos;ve been notified and are looking into it.
            {error.digest && <> Error ID: <code>{error.digest}</code></>}
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.75rem', background: '#16a34a', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
