"use client";

// Catches runtime errors thrown by any route segment below the root layout.
// This is a Client Component — Next.js requires it.

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error tracking service here (e.g. Sentry)
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center px-6 font-serif selection:bg-[#7D5A34]/20">
      <div className="text-center max-w-md">

        <div className="flex justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-[#7D5A34]" strokeWidth={1.5} />
        </div>

        <span className="font-sans text-[9px] uppercase tracking-[0.3em] font-bold text-[#1A1A1A]/40 block mb-3">
          Unexpected Error
        </span>

        <h2 className="text-3xl font-normal tracking-tight mb-4">Something went wrong</h2>

        <p className="font-sans text-sm text-[#1A1A1A]/60 mb-8 leading-relaxed">
          An unexpected error occurred while loading this page. You can try again or return to the homepage.
        </p>

        {error.digest && (
          <p className="font-mono text-[10px] text-[#1A1A1A]/30 mb-6">
            Error reference: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#7D5A34] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Try Again
          </button>
          <a
            href="/"
            className="flex items-center justify-center gap-2 font-sans text-[11px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 px-6 py-3 hover:bg-[#1A1A1A]/5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" strokeWidth={2} /> Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
