/**
 * Live Firestore ownership periods for timestamp-based fantasy scoring.
 * Populated by migration / waiver settles; must align with `owners` squads.
 */

import { getFirebaseApp, isFirebaseConfigured } from "./client";
import type { ClientOwnershipPeriod } from "../franchiseAttributedScoring";

const COL = "ownershipPeriods";

export type OwnershipPeriodsUnsub = () => void;

function mapDoc(data: Record<string, unknown>): ClientOwnershipPeriod | null {
  const playerId = typeof data.playerId === "string" ? data.playerId : "";
  const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
  const acquiredAt = typeof data.acquiredAt === "string" ? data.acquiredAt : "";
  const releasedAt = data.releasedAt;
  const rel =
    releasedAt === null || releasedAt === undefined
      ? null
      : typeof releasedAt === "string"
        ? releasedAt
        : null;
  if (!playerId || !ownerId || !acquiredAt) return null;
  return { playerId, ownerId, acquiredAt, releasedAt: rel };
}

/**
 * Subscribe to all ownership period docs. Scoring uses these when non-empty
 * (authoritative vs waiver `rosterHistory` replay).
 */
export async function subscribeOwnershipPeriods(
  onData: (periods: ClientOwnershipPeriod[]) => void,
  onError?: (e: Error) => void,
): Promise<OwnershipPeriodsUnsub | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const { getFirestore, collection, onSnapshot } = await import("firebase/firestore");
    const app = await getFirebaseApp();
    const db = getFirestore(app);
    return onSnapshot(
      collection(db, COL),
      (snap) => {
        const periods: ClientOwnershipPeriod[] = [];
        for (const d of snap.docs) {
          const row = mapDoc(d.data() as Record<string, unknown>);
          if (row) periods.push(row);
        }
        onData(periods);
      },
      (err) => onError?.(err),
    );
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}
