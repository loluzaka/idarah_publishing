// Client-side admin claim check.
// Server-side admin verification should use firebase-admin's verifyIdToken
// and inspect decoded.admin === true.

import { User } from 'firebase/auth';

/**
 * Read the `admin` custom claim from the user's ID token.
 * Returns false if the user is null, unverified, or has no admin claim.
 *
 * Call forceRefresh=true after granting/revoking admin so the browser
 * picks up the new token immediately (otherwise Firebase caches for ~1h).
 */
export async function isAdmin(user: User | null, forceRefresh = false): Promise<boolean> {
  if (!user) return false;
  try {
    const tokenResult = await user.getIdTokenResult(forceRefresh);
    return tokenResult.claims?.admin === true;
  } catch (err) {
    console.warn('Failed to read admin claim:', err);
    return false;
  }
}
