/**
 * Optional Firestore sync for shared waiver state (honor-system; use open rules only in private leagues).
 * Set VITE_FIREBASE_* env vars to enable.
 */

const DOC_PATH = "iplFantasy/waiverState";

export function isFirebaseWaiverConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID,
  );
}

function firebaseConfig(): { apiKey: string; authDomain: string; projectId: string } {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) {
    throw new Error("Firebase env incomplete");
  }
  return { apiKey, authDomain, projectId };
}

async function getWaiverApp() {
  const { initializeApp, getApp, getApps } = await import("firebase/app");
  return getApps().length ? getApp() : initializeApp(firebaseConfig());
}

export type Unsub = () => void;

export async function subscribeWaiverRemote(
  onRemote: (data: unknown) => void,
  onError?: (e: Error) => void,
): Promise<Unsub | null> {
  if (!isFirebaseWaiverConfigured()) return null;
  try {
    const { getFirestore, doc, onSnapshot } = await import("firebase/firestore");
    const app = await getWaiverApp();
    const db = getFirestore(app);
    const [col, id] = DOC_PATH.split("/");
    const d = doc(db, col, id);
    return onSnapshot(
      d,
      (snap) => {
        if (!snap.exists()) return;
        onRemote(snap.data()?.payload);
      },
      (err) => onError?.(err),
    );
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}

export async function pushWaiverRemote(payload: unknown): Promise<void> {
  if (!isFirebaseWaiverConfigured()) return;
  const { getFirestore, doc, setDoc, serverTimestamp } = await import(
    "firebase/firestore"
  );
  const app = await getWaiverApp();
  const db = getFirestore(app);
  const [col, id] = DOC_PATH.split("/");
  await setDoc(
    doc(db, col, id),
    { payload, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
