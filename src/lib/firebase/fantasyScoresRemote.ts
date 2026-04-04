/**
 * Firestore overlay: per-match fantasy points merged into the static league bundle.
 * Document: iplFantasy/fantasyMatchScores — field `matches` is a map of matchKey → entry.
 */

import type { FantasyMatchOverlayEntry } from "../../types";
import { getFirebaseApp, isFirebaseConfigured } from "./client";

export type Unsub = () => void;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function normalizePlayerPoints(x: unknown): Record<string, number> {
  if (!isPlainObject(x)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Accept Firestore snapshot shapes (including Timestamp for matchDate). */
export function normalizeFantasyMatchEntry(
  raw: unknown,
): FantasyMatchOverlayEntry | null {
  if (!isPlainObject(raw)) return null;
  const matchKey = raw.matchKey;
  const matchLabel = raw.matchLabel;
  const matchDate = raw.matchDate;
  if (typeof matchKey !== "string" || matchKey.length === 0) return null;
  if (typeof matchLabel !== "string") return null;
  let dateStr: string;
  if (typeof matchDate === "string") dateStr = matchDate;
  else if (
    matchDate &&
    typeof matchDate === "object" &&
    "toDate" in matchDate &&
    typeof (matchDate as { toDate?: () => Date }).toDate === "function"
  ) {
    dateStr = (matchDate as { toDate: () => Date }).toDate().toISOString();
  } else return null;
  const status = raw.status;
  const cricketMatchId = raw.cricketMatchId;
  const source = raw.source;
  return {
    matchKey,
    matchLabel,
    matchDate: dateStr,
    status:
      status === "final" ||
      status === "abandoned" ||
      status === "provisional"
        ? status
        : undefined,
    playerPoints: normalizePlayerPoints(raw.playerPoints),
    cricketMatchId: typeof cricketMatchId === "string" ? cricketMatchId : undefined,
    source: typeof source === "string" ? source : undefined,
  };
}

export async function subscribeFantasyMatchOverlays(
  onData: (entries: FantasyMatchOverlayEntry[]) => void,
  onError?: (e: Error) => void,
): Promise<Unsub | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const { getFirestore, doc, onSnapshot } = await import("firebase/firestore");
    const app = await getFirebaseApp();
    const db = getFirestore(app);
    const d = doc(db, "iplFantasy", "fantasyMatchScores");
    return onSnapshot(
      d,
      (snap) => {
        if (!snap.exists()) {
          onData([]);
          return;
        }
        const matches = snap.data()?.matches;
        if (!isPlainObject(matches)) {
          onData([]);
          return;
        }
        const list: FantasyMatchOverlayEntry[] = [];
        for (const v of Object.values(matches)) {
          const n = normalizeFantasyMatchEntry(v);
          if (n) list.push(n);
        }
        onData(list);
      },
      (err) => onError?.(err),
    );
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return null;
  }
}
