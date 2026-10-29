"use client";

// React hook — loads the current user's Firestore profile once per session
// and exposes discountRate app-wide. Use it wherever a price is rendered.

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getUserProfile, UserProfile } from '@/app/lib/userProfile';

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;
  // Tagged with the uid it was fetched for, so switching/clearing the user
  // never shows (or waits on) a previous user's profile.
  const [fetched, setFetched] = useState<{ uid: string; profile: UserProfile | null } | null>(null);

  useEffect(() => {
    if (authLoading || !uid) return;
    let cancelled = false;
    getUserProfile(uid).then(p => {
      if (!cancelled) setFetched({ uid, profile: p });
    });
    return () => { cancelled = true; };
  }, [uid, authLoading]);

  const profile = uid && fetched?.uid === uid ? fetched.profile : null;
  const loading = authLoading || (!!uid && fetched?.uid !== uid);

  return {
    profile,
    loading,
    /** 0-100 — safe to pass directly into computePrice(). Anonymous users get 0. */
    discountRate: profile?.discountRate ?? 0,
    /** Convenient hook for gating UI. */
    isVerified: profile?.verificationStatus === 'approved' || profile?.verificationStatus === 'not_required',
    accountType: profile?.accountType ?? 'regular',
  };
}
