"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { createUserProfile, ACCOUNT_TYPES, AccountType } from '@/app/lib/userProfile';

// Official multi-colour Google "G" mark.
function GoogleGLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const auth = getAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('regular');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mergeGuestCartToAccount = (userUid: string) => {
    const guestCartStr = localStorage.getItem('iad_cart_GUEST');
    const userCartStr = localStorage.getItem(`iad_cart_${userUid}`);

    let guestCart = guestCartStr ? JSON.parse(guestCartStr) : [];
    let userCart = userCartStr ? JSON.parse(userCartStr) : [];

    guestCart.forEach((guestItem: any) => {
      const existingItem = userCart.find((uItem: any) => uItem.id === guestItem.id);
      if (existingItem) {
        existingItem.quantity += guestItem.quantity;
      } else {
        userCart.push(guestItem);
      }
    });

    localStorage.setItem(`iad_cart_${userUid}`, JSON.stringify(userCart));
    localStorage.removeItem('iad_cart_GUEST');
    localStorage.setItem('iad_cart', JSON.stringify(userCart));
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        await createUserProfile({
          uid: userCredential.user.uid,
          name,
          email,
          phone,
          accountType,
        });
        mergeGuestCartToAccount(userCredential.user.uid);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        mergeGuestCartToAccount(userCredential.user.uid);
      }
      router.push('/books');
    } catch (err: any) {
      setError(err.message.replace('Firebase:', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await createUserProfile({
        uid: result.user.uid,
        name: result.user.displayName ?? '',
        email: result.user.email ?? '',
        accountType: 'regular',
      });
      mergeGuestCartToAccount(result.user.uid);
      router.push('/books');
    } catch (err: any) {
      setError(err.message.replace('Firebase:', ''));
    }
  };

  const selectedMeta = ACCOUNT_TYPES.find(t => t.value === accountType);
  const googleLabel = isRegistering ? 'Sign up with Google' : 'Sign in with Google';

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#1A1A1A] flex items-center justify-center px-6 py-12 font-sans relative">

      <div className="absolute top-6 left-6 md:top-10 md:left-10">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[#1A1A1A] bg-white border border-[#1A1A1A]/20 hover:border-[#1A1A1A] px-4 py-2.5 transition-all shadow-sm rounded-sm"
        >
          ← Keep Browsing
        </button>
      </div>

      <div className="max-w-md w-full bg-white border border-[#1A1A1A]/10 p-8 shadow-sm rounded-sm">
        <h2 className="font-serif text-2xl font-normal text-center mb-1">
          {isRegistering ? 'Create Account' : 'Sign In to Explore'}
        </h2>
        <p className="text-[10px] text-[#7D5A34] text-center tracking-widest uppercase font-semibold mb-6">
          Idarah-i Adabiyat-i Dilli
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm">{error}</div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isRegistering && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/60 mb-1.5">Full Name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none focus:border-[#7D5A34] rounded-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/60 mb-1.5">Phone (optional)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91"
                  className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none focus:border-[#7D5A34] rounded-sm" />
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/60 mb-1.5">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none focus:border-[#7D5A34] rounded-sm" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/60 mb-1.5">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none focus:border-[#7D5A34] rounded-sm" />
          </div>

{isRegistering && (
  <div>
    <label className="block text-[10px] uppercase tracking-widest font-bold text-[#1A1A1A]/60 mb-1.5">
      Account Type
    </label>
    <select
      value={accountType}
      onChange={e => setAccountType(e.target.value as AccountType)}
      className="w-full bg-white border border-[#1A1A1A]/15 p-3 text-xs outline-none focus:border-[#7D5A34] rounded-sm text-[#1A1A1A]"
    >
      <option value="regular">Reader / Regular Customer</option>
      <option value="student">Student / Scholar (Verification Required)</option>
      <option value="author">Author / Academic Contributor</option>
      <option value="library">Library / Institutional Buyer</option>
      <option value="distributor">Distributor / Trade Partner</option>
    </select>
    
    {selectedMeta?.requiresVerification && (
      <p className="text-[10px] text-[#7D5A34] italic mt-2 leading-relaxed">
        Special accounts require manual verification. You can shop at regular rates while your account is under review.
      </p>
    )}
  </div>
)}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A1A1A] hover:bg-[#7D5A34] text-white text-xs font-bold uppercase tracking-widest py-3.5 transition-colors rounded-sm disabled:opacity-50"
          >
            {loading ? 'Verifying Credentials...' : isRegistering ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-[#1A1A1A]/10"></div>
          <span className="flex-shrink mx-3 text-[10px] uppercase text-[#1A1A1A]/40 tracking-widest">or</span>
          <div className="flex-grow border-t border-[#1A1A1A]/10"></div>
        </div>

        {/* Official Google branding — G mark + capitalised label */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          aria-label={googleLabel}
          className="w-full bg-white border border-[#1A1A1A]/20 hover:border-[#1A1A1A] hover:shadow-sm text-[#1A1A1A] text-sm font-medium py-3 flex items-center justify-center gap-3 transition-all rounded-sm"
        >
          <GoogleGLogo className="w-4 h-4" />
          <span className="font-sans">{googleLabel}</span>
        </button>

        <p className="text-center text-xs text-[#1A1A1A]/60 mt-6 pt-4 border-t border-[#1A1A1A]/5">
          {isRegistering ? 'Already registered? ' : "Don't have an account? "}
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-[#7D5A34] underline font-medium hover:text-[#1A1A1A]">
            {isRegistering ? 'Sign In Here' : 'Register Here'}
          </button>
        </p>
      </div>
    </div>
  );
}
