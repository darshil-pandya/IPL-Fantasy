/**
 * Optional Firestore sync for shared waiver state (honor-system; use open rules only in private leagues).
 * Set VITE_FIREBASE_* env vars to enable.
 */

import { getFirebaseApp, isFirebaseConfigured } from "./client";

const DOC_PATH = "iplFantasy/waiverState";

export const isFirebaseWaiverConfigured = isFirebaseConfigured;

export type Unsub = () => void;

export async function subscribeWaiverRemote(
  onRemote: (data: unknown) => void,
  onError?: (e: Error) => void,
): Promise<Unsub | null> {
  if (!isFirebaseWaiverConfigured()) return null;
  try {
    const { getFirestore, doc, onSnapshot } = await import("firebase/firestore");
    const app = await getFirebaseApp();
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
  const app = await getFirebaseApp();
  const db = getFirestore(app);
  const [col, id] = DOC_PATH.split("/");
  await setDoc(
    doc(db, col, id),
    { payload, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
