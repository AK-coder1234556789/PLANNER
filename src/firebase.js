import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged as realOnAuthStateChanged,
  signInWithPopup as realSignInWithPopup,
  signInWithRedirect as realSignInWithRedirect,
  getRedirectResult as realGetRedirectResult,
  signOut as realSignOut,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  collection as realCollection,
  doc as realDoc,
  addDoc as realAddDoc,
  updateDoc as realUpdateDoc,
  deleteDoc as realDeleteDoc,
  setDoc as realSetDoc,
  onSnapshot as realOnSnapshot,
  arrayUnion as realArrayUnion,
  arrayRemove as realArrayRemove,
} from 'firebase/firestore';
import { localStore } from './localStore';

const e = import.meta.env;
// true only when the .env values have been filled in
export const configured = Boolean(e.VITE_FIREBASE_API_KEY && e.VITE_FIREBASE_PROJECT_ID);

let app = null;
let auth = null;
let db = null;
let provider = null;

if (configured) {
  try {
    app = initializeApp({
      apiKey: e.VITE_FIREBASE_API_KEY,
      authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: e.VITE_FIREBASE_PROJECT_ID,
      storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: e.VITE_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch (err) {
    console.warn('Firebase initialization error:', err);
  }
}

// Guest user state & persistence
const GUEST_KEY = 'jee_planner_guest_active';
let isGuestActive = false;
try {
  isGuestActive = localStorage.getItem(GUEST_KEY) === 'true';
} catch {
  // ignore
}

export const GUEST_USER = {
  uid: 'guest',
  displayName: 'JEE Aspirant',
  email: 'aspirant@jee.local',
  photoURL: '',
  isGuest: true,
};

const authListeners = new Set();

export function onAuthStateChanged(authInstance, callback) {
  authListeners.add(callback);

  if (isGuestActive) {
    callback(GUEST_USER);
  } else if (configured && auth) {
    return realOnAuthStateChanged(auth, (user) => {
      if (!isGuestActive) {
        callback(user);
      }
    });
  } else {
    callback(null);
  }

  return () => {
    authListeners.delete(callback);
  };
}

export function signInGuest() {
  isGuestActive = true;
  try {
    localStorage.setItem(GUEST_KEY, 'true');
  } catch {
    // ignore
  }
  authListeners.forEach((fn) => fn(GUEST_USER));
}

export async function signOut(authInstance) {
  if (isGuestActive) {
    isGuestActive = false;
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // ignore
    }
    authListeners.forEach((fn) => fn(null));
    return;
  }
  if (configured && auth) {
    await realSignOut(auth);
  }
}

export async function signInWithPopup(authInstance, providerInstance) {
  if (configured && auth) {
    return await realSignInWithPopup(auth, providerInstance || provider);
  }
  signInGuest();
  return { user: GUEST_USER };
}

export async function signInWithRedirect(authInstance, providerInstance) {
  if (configured && auth) {
    return await realSignInWithRedirect(auth, providerInstance || provider);
  }
  signInGuest();
}

export async function getRedirectResult(authInstance) {
  if (configured && auth) {
    return await realGetRedirectResult(auth);
  }
  return null;
}

export function collection(dbInstance, ...segments) {
  return {
    _type: 'collection',
    path: segments,
    db: dbInstance,
  };
}

export function doc(dbInstance, ...segments) {
  return {
    _type: 'doc',
    path: segments,
    db: dbInstance,
  };
}

export function arrayUnion(...elements) {
  const fv = (configured && db) ? realArrayUnion(...elements) : {};
  fv._mockOp = 'arrayUnion';
  fv._elements = elements;
  return fv;
}

export function arrayRemove(...elements) {
  const fv = (configured && db) ? realArrayRemove(...elements) : {};
  fv._mockOp = 'arrayRemove';
  fv._elements = elements;
  return fv;
}

export function onSnapshot(ref, optionsOrCb, maybeCb) {
  const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
  const isGuest = isGuestActive || !configured || ref.path?.[1] === 'guest';

  if (isGuest) {
    const notify = () => {
      if (ref._type === 'collection') {
        const colName = ref.path[ref.path.length - 1];
        const items = localStore.getCollection(colName);
        cb({
          docs: items.map((item) => ({
            id: item.id,
            data: () => item,
          })),
          metadata: { hasPendingWrites: false, fromCache: false },
        });
      } else {
        const colName = ref.path[ref.path.length - 2];
        const docId = ref.path[ref.path.length - 1];
        const item = localStore.getDoc(colName, docId);
        cb({
          id: docId,
          exists: () => Boolean(item),
          data: () => item || {},
          metadata: { hasPendingWrites: false, fromCache: false },
        });
      }
    };

    notify();
    return localStore.subscribe(notify);
  }

  if (ref._type === 'collection') {
    const realRef = realCollection(db, ...ref.path);
    return realOnSnapshot(realRef, optionsOrCb, maybeCb);
  } else {
    const realRef = realDoc(db, ...ref.path);
    return realOnSnapshot(realRef, optionsOrCb, maybeCb);
  }
}

export async function addDoc(colRef, data) {
  const isGuest = isGuestActive || !configured || colRef.path?.[1] === 'guest';
  if (isGuest) {
    const colName = colRef.path[colRef.path.length - 1];
    return localStore.addDoc(colName, data);
  }
  const realRef = realCollection(db, ...colRef.path);
  return await realAddDoc(realRef, data);
}

export async function updateDoc(docRef, patch) {
  const isGuest = isGuestActive || !configured || docRef.path?.[1] === 'guest';
  if (isGuest) {
    const colName = docRef.path[docRef.path.length - 2];
    const docId = docRef.path[docRef.path.length - 1];
    return localStore.updateDoc(colName, docId, patch);
  }
  const realRef = realDoc(db, ...docRef.path);
  return await realUpdateDoc(realRef, patch);
}

export async function deleteDoc(docRef) {
  const isGuest = isGuestActive || !configured || docRef.path?.[1] === 'guest';
  if (isGuest) {
    const colName = docRef.path[docRef.path.length - 2];
    const docId = docRef.path[docRef.path.length - 1];
    return localStore.deleteDoc(colName, docId);
  }
  const realRef = realDoc(db, ...docRef.path);
  return await realDeleteDoc(realRef);
}

export async function setDoc(docRef, data) {
  const isGuest = isGuestActive || !configured || docRef.path?.[1] === 'guest';
  if (isGuest) {
    const colName = docRef.path[docRef.path.length - 2];
    const docId = docRef.path[docRef.path.length - 1];
    return localStore.setDoc(colName, docId, data);
  }
  const realRef = realDoc(db, ...docRef.path);
  return await realSetDoc(realRef, data);
}

export { auth, provider, db };
