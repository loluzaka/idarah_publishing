"use client";

import React, { useEffect, useState } from 'react';
import { UserCog, Check, Percent } from 'lucide-react';
import {
  getUserProfile,
  adminReassignAccount,
  ACCOUNT_TYPES,
  AccountType,
  UserProfile,
} from '@/app/lib/userProfile';

export default function AdminUsersPage() {
  const [emailKey, setEmailKey] = useState('');
  const [found, setFound] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [newType, setNewType] = useState<AccountType>('regular');
  const [newDiscount, setNewDiscount] = useState('');
  const [saving, setSaving] = useState(false);

  // UID lookup by email needs a Firestore query helper — for now we resolve
  // via a small prompt: paste the user's uid (visible on their orders), or extend
  // find-by-email later. We keep the lookup explicit and simple instead.
  const [uidInput, setUidInput] = useState('');

  const show = (kind: 'ok' | 'err', text: string) => setNotice({ kind, text });

  const handleLookup = async () => {
    const uid = uidInput.trim();
    if (!uid) { show('err', 'Paste a user id first.'); return; }
    setLoading(true);
    setNotice(null);
    setFound(null);
    try {
      const p = await getUserProfile(uid);
      if (!p) { show('err', 'No user found with that id.'); return; }
      setFound(p);
      setNewType(p.accountType);
      setNewDiscount(String(p.discountRate ?? 0));
      void emailKey;
    } catch (err) {
      console.warn(err);
      show('err', 'Lookup failed. Check the id and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!found) return;
    const rate = Number(newDiscount);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      show('err', 'Discount must be a number between 0 and 100.');
      return;
    }
    if (!confirm(`Change ${found.name || found.email || found.uid} to "${ACCOUNT_TYPES.find(a => a.value === newType)?.label}" at ${rate}%?`)) return;
    setSaving(true);
    try {
      // NOTE: replace `user.uid` with the admin's uid once wired (see below).
      await adminReassignAccount(found.uid, newType, 'admin-console', rate);
      const refreshed = await getUserProfile(found.uid);
      setFound(refreshed);
      show('ok', `Saved: ${ACCOUNT_TYPES.find(a => a.value === newType)?.label} at ${rate}%. Verification is now "${refreshed?.verificationStatus}".`);
    } catch (err) {
      console.warn(err);
      show('err', 'Save failed — you may lack Firestore write permission on users/{uid}.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#1A1A1A]/10">
        <UserCog className="w-6 h-6 text-[#7D5A34]" strokeWidth={1.5} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#7D5A34] font-bold block">Accounts</span>
          <h1 className="font-serif text-3xl font-normal">Reassign User</h1>
        </div>
      </div>

      {/* Lookup */}
      <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm mb-6">
        <label className="block text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 mb-1.5">
          User id (uid)
        </label>
        <p className="text-[10px] text-[#1A1A1A]/50 mb-2 leading-relaxed">
          Find it on any of the user's rows in Admin → Orders (click the order to see the uid), or in Firebase Console → Authentication.
        </p>
        <div className="flex gap-2">
          <input
            value={uidInput}
            onChange={e => setUidInput(e.target.value)}
            placeholder="paste uid…"
            className="flex-1 border border-[#1A1A1A]/15 px-3 py-2 text-xs font-mono outline-none focus:border-[#7D5A34]"
          />
          <button
            onClick={handleLookup}
            disabled={loading}
            className="text-[10px] font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-4 py-2 hover:bg-[#7D5A34] transition-colors disabled:opacity-40"
          >
            {loading ? 'Searching…' : 'Find user'}
          </button>
        </div>
      </div>

      {notice && (
        <p className={`text-[11px] mb-4 px-3 py-2 border ${notice.kind === 'ok' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {notice.text}
        </p>
      )}

      {found && (
        <div className="bg-white border border-[#1A1A1A]/10 p-5 rounded-sm">
          <p className="font-serif text-base font-bold">{found.name || <em className="italic text-[#1A1A1A]/40">Unnamed</em>}</p>
          <p className="text-[11px] text-[#1A1A1A]/50 mt-0.5">{found.email}</p>
          <p className="text-[10px] text-[#1A1A1A]/50 mt-1">
            Now: {ACCOUNT_TYPES.find(a => a.value === found.accountType)?.label ?? found.accountType}
            {' · '}{String(found.verificationStatus).replace(/_/g, ' ')}
            {' · '}{found.discountRate ?? 0}% off
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 mb-1.5">
                New account type
              </label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as AccountType)}
                className="w-full bg-white border border-[#1A1A1A]/15 p-2.5 text-xs outline-none focus:border-[#7D5A34]"
              >
                {ACCOUNT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}{t.requiresVerification ? ' (verification)' : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#1A1A1A]/50 italic mt-2 leading-relaxed">
                Switching to a verified type re-opens the account as pending review; switching to Regular clears it to not-required. Discount resets to the new type's default unless you type a value.
              </p>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-[#1A1A1A]/40 mb-1.5 flex items-center gap-1">
                <Percent className="w-3 h-3" /> Discount Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={newDiscount}
                onChange={e => setNewDiscount(e.target.value)}
                className="w-full border border-[#1A1A1A]/15 px-3 py-2 text-sm outline-none focus:border-[#7D5A34] font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white px-4 py-2.5 hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            <Check className="w-3 h-3" /> Save new type + discount
          </button>
        </div>
      )}
    </div>
  );
}
