"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { ShieldCheck, Check, X, Percent } from 'lucide-react';
import {
  listPendingVerifications,
  adminSetVerification,
  ACCOUNT_TYPES,
  UserProfile,
} from '@/app/lib/userProfile';

export default function AdminVerificationPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const list = await listPendingVerifications();
    setPending(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (u: UserProfile) => {
    if (!user) return;
    setBusyId(u.uid);
    const rate = Number(discounts[u.uid] ?? '0');
    await adminSetVerification(u.uid, 'approved', user.uid, Number.isFinite(rate) ? rate : 0);
    setPending(prev => prev.filter(p => p.uid !== u.uid));
    setBusyId(null);
  };

  const handleReject = async (u: UserProfile) => {
    if (!user) return;
    if (!confirm(`Reject verification for ${u.name || u.email}?`)) return;
    setBusyId(u.uid);
    await adminSetVerification(u.uid, 'rejected', user.uid);
    setPending(prev => prev.filter(p => p.uid !== u.uid));
    setBusyId(null);
  };

  const labelFor = (t: string) => ACCOUNT_TYPES.find(a => a.value === t)?.label ?? t;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <ShieldCheck className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Approvals</span>
          <h1 className="font-serif text-3xl font-normal">Verification Requests</h1>
        </div>
      </div>

      {loading ? (
        <p className="text-xs italic text-[#1A1A1A]/40 animate-pulse">Loading requests…</p>
      ) : pending.length === 0 ? (
        <div className="border border-dashed border-[#1A1A1A]/10 bg-white p-12 text-center rounded-sm">
          <p className="text-xs italic text-[#1A1A1A]/50">No pending verification requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(u => {
            const busy = busyId === u.uid;
            return (
              <div key={u.uid} className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                  {/* Applicant details */}
                  <div>
                    <div className="flex items-start gap-3 mb-2 flex-wrap">
                      <div>
                        <p className="font-serif text-base font-bold">{u.name || <em className="italic text-[#1A1A1A]/40">Unnamed</em>}</p>
                        <p className="text-[11px] text-[#1A1A1A]/50 mt-0.5">{u.email}</p>
                        {u.phone && <p className="text-[10px] text-[#1A1A1A]/50">📞 {u.phone}</p>}
                      </div>
                      <span className="text-[9px] uppercase tracking-widest font-bold bg-[#7D5A34]/10 text-[#7D5A34] border border-[#7D5A34]/15 px-2.5 py-1 rounded-sm ml-auto">
                        {labelFor(u.accountType)}
                      </span>
                    </div>
                    {u.createdAt && (
                      <p className="text-[10px] text-[#1A1A1A]/40 mt-2">
                        Requested {new Date(u.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 md:min-w-[260px]">
                    <label className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 flex items-center gap-1">
                      <Percent className="w-3 h-3" /> Discount Rate (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discounts[u.uid] ?? ''}
                      placeholder="0"
                      onChange={e => setDiscounts(d => ({ ...d, [u.uid]: e.target.value }))}
                      className="border border-[#1A1A1A]/15 px-2 py-1.5 text-sm outline-none focus:border-[#7D5A34] font-mono"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white px-3 py-2 hover:bg-green-700 transition-colors disabled:opacity-40"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(u)}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-[#1A1A1A]/20 text-[#1A1A1A] px-3 py-2 hover:bg-[#1A1A1A]/5 transition-colors disabled:opacity-40"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
