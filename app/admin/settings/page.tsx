"use client";

import React from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Settings, Info } from 'lucide-react';

export default function AdminSettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <Settings className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Configuration</span>
          <h1 className="font-serif text-3xl font-normal">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
          <h3 className="font-serif text-lg mb-3">Signed-In Admin</h3>
          <div className="space-y-2 text-xs">
            <p><span className="text-[#1A1A1A]/50 font-bold uppercase tracking-widest text-[9px] block">Email</span>{user?.email}</p>
            <p><span className="text-[#1A1A1A]/50 font-bold uppercase tracking-widest text-[9px] block mt-2">Display Name</span>{user?.displayName ?? '—'}</p>
            <p><span className="text-[#1A1A1A]/50 font-bold uppercase tracking-widest text-[9px] block mt-2">UID</span><span className="font-mono">{user?.uid}</span></p>
          </div>
        </div>

        <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-[#7D5A34]" />
            <h3 className="font-serif text-lg">Managing Admin Access</h3>
          </div>
          <p className="text-xs text-[#1A1A1A]/70 leading-relaxed mb-3">
            Admin privileges are granted via Firebase custom claims. To grant or revoke admin access, run:
          </p>
          <pre className="bg-[#1A1A1A]/[0.03] border border-[#1A1A1A]/10 p-3 text-[10px] font-mono overflow-x-auto rounded-sm">
{`node scripts/set-admin.mjs grant user@example.com
node scripts/set-admin.mjs revoke user@example.com`}
          </pre>
          <p className="text-[10px] text-[#1A1A1A]/50 mt-3 italic">
            The user must sign out and sign back in for the change to take effect.
          </p>
        </div>

        <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
          <h3 className="font-serif text-lg mb-3">Environment</h3>
          <div className="space-y-2 text-xs text-[#1A1A1A]/70">
            <p>Sanity Studio URL: <code className="font-mono text-[10px] bg-[#1A1A1A]/[0.03] px-1.5 py-0.5 rounded">{process.env.NEXT_PUBLIC_SANITY_STUDIO_URL || '/studio (default)'}</code></p>
            <p className="text-[10px] italic text-[#1A1A1A]/50 mt-2">Set <code className="font-mono">NEXT_PUBLIC_SANITY_STUDIO_URL</code> in <code className="font-mono">.env.local</code> if your Studio is hosted elsewhere.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
