"use client";

// Catches errors thrown in the root layout itself.
// Must include its own <html> and <body> since the layout may be broken.

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'Georgia, serif', background: '#FBFBFA', color: '#1A1A1A', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <div>
          <p style={{ fontFamily: 'sans-serif', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold', color: '#7D5A34', marginBottom: '12px' }}>
            Critical Error
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 'normal', marginBottom: '16px' }}>
            Something went critically wrong
          </h2>
          <p style={{ fontFamily: 'sans-serif', fontSize: '14px', color: '#1A1A1A99', marginBottom: '32px', lineHeight: 1.6 }}>
            The application encountered a critical error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.15em', background: '#1A1A1A', color: '#FBFBFA', border: 'none', padding: '12px 24px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
