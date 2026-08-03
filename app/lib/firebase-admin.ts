// Firebase Admin SDK — server-only, never import this on the client.
// Used to verify Firebase ID tokens and read/write Firestore inside
// Next.js API route handlers.
//
// SETUP (one-time)
// ----------------
// Add these to .env.local (or your hosting provider's env vars):
//
//   FIREBASE_PROJECT_ID=your-project-id
//   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
//
// Get these values from Firebase Console → Project Settings → Service Accounts
// → Generate new private key → open the downloaded JSON.
//
// On your host, paste the private key exactly as shown (with literal \n
// characters); the platform handles the escaping automatically.

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin(): void {
  if (getApps().length > 0) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    return;
  }

  // Fallback for local dev when GOOGLE_APPLICATION_CREDENTIALS is set
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { applicationDefault } = require('firebase-admin/app');
    initializeApp({ credential: applicationDefault() });
  } catch (err) {
    console.warn(
      '[firebase-admin] Could not initialize. ' +
      'Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY ' +
      'or GOOGLE_APPLICATION_CREDENTIALS. ' +
      'API authentication will be skipped until configured.',
      err
    );
  }
}

initAdmin();

/**
 * Verify an ID token from an "Authorization: Bearer <token>" header.
 * Returns the verified uid, or null if the token is missing / invalid.
 */
export async function verifyIdToken(authHeader: string | null | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Lazily return the Admin Firestore instance. Called inside request handlers
 * so it never runs at import time (keeps local dev without credentials safe).
 */
export function getAdminDb() {
  return getFirestore();
}
