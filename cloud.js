import { firebaseConfig } from "./firebase-config.js";

// The only file that talks to Firebase: sign-in and the one cloud record per person. The
// Firebase libraries load from Google's CDN the first time they are needed, so the app opens
// just as fast without an account, and the service worker keeps a copy for offline use.
// Firestore Lite is the small version of the database library: it reads and writes single
// records, which is all the app needs.

const SDK_URL = "https://www.gstatic.com/firebasejs/11.0.2";
const USERS_COLLECTION = "users";

let firebaseReady = null;

function firebase() {
  if (firebaseReady === null) {
    firebaseReady = Promise.all([
      import(`${SDK_URL}/firebase-app.js`),
      import(`${SDK_URL}/firebase-auth.js`),
      import(`${SDK_URL}/firebase-firestore-lite.js`),
    ]).then(([appSdk, authSdk, storeSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      return { auth: authSdk.getAuth(app), db: storeSdk.getFirestore(app), authSdk, storeSdk };
    });
    // A failed load (offline on the first visit) can be retried later.
    firebaseReady.catch(() => {
      firebaseReady = null;
    });
  }
  return firebaseReady;
}

const toUser = (user) => (user ? { uid: user.uid, email: user.email } : null);

// Calls `onUser` with { uid, email } or null now and whenever sign-in changes. Rejects if the
// Firebase libraries can't be loaded.
export async function watchUser(onUser) {
  const { auth, authSdk } = await firebase();
  authSdk.onAuthStateChanged(auth, (user) => onUser(toUser(user)));
}

export async function signIn(email, password) {
  const { auth, authSdk } = await firebase();
  await authSdk.signInWithEmailAndPassword(auth, email, password);
}

export async function createAccount(email, password) {
  const { auth, authSdk } = await firebase();
  await authSdk.createUserWithEmailAndPassword(auth, email, password);
}

export async function sendPasswordReset(email) {
  const { auth, authSdk } = await firebase();
  await authSdk.sendPasswordResetEmail(auth, email);
}

export async function signOutUser() {
  const { auth, authSdk } = await firebase();
  await authSdk.signOut(auth);
}

// The person's cloud record as stored, or null if they have never uploaded.
export async function readCloudRecord(uid) {
  const { db, storeSdk } = await firebase();
  const snapshot = await storeSdk.getDoc(storeSdk.doc(db, USERS_COLLECTION, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function writeCloudRecord(uid, record) {
  const { db, storeSdk } = await firebase();
  await storeSdk.setDoc(storeSdk.doc(db, USERS_COLLECTION, uid), record);
}
