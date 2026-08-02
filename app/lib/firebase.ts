// Shared Firestore instance. Re-uses the Firebase app initialized in AuthContext.
import { getFirestore } from 'firebase/firestore';
import { auth } from '@/app/context/AuthContext';

// getFirestore accepts a FirebaseApp; auth.app is the already-initialized app.
export const db = getFirestore(auth.app);
