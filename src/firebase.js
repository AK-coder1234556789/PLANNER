import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const e = import.meta.env;
// true only when the .env values have been filled in
export const configured = Boolean(e.VITE_FIREBASE_API_KEY && e.VITE_FIREBASE_PROJECT_ID);

const app = initializeApp({
  apiKey: e.VITE_FIREBASE_API_KEY || 'missing',
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID || 'missing',
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: e.VITE_FIREBASE_APP_ID,
});
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
// offline cache: the app opens and works without internet, and syncs when back online
export const db = initializeFirestore(app, { localCache: persistentLocalCache() });
