"use client";

// React hook — loads the current user's Firestore profile once per session
// and exposes discountRate app-wide. Use it wherever a price is rendered.

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getUserProfile, UserProfile } from '@/app/lib/userProfile';

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    (async () => {
      const p = await getUserProfile(user.uid);
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, authLoading]);

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
