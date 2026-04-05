import { getFirebaseApp, isFirebaseConfigured } from "./client";

export type AdminScoreSyncResponse = {
  ok: boolean;
  matchLabel: string;
  matchKey: string;
  matchDate: string;
  /** ESPN full scorecard URL (single source of truth). */
  scorecardUrl: string;
  source: "espncricinfo";
  scorecardComplete: boolean;
  validated: boolean;
  playerPoints: Record<string, number>;
  inconsistencies: string[];
  warnings: string[];
  wroteFirestore: boolean;
  note?: string;
};

function functionsRegion(): string {
  return import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || "asia-south1";
}

export async function callAdminScoreSync(params: {
  matchQuery: string;
  matchDateYmd: string;
  adminSyncSecret: string;
  writeToFirestore: boolean;
}): Promise<AdminScoreSyncResponse> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured (missing VITE_FIREBASE_* env).");
  }
  const { getFunctions, httpsCallable } = await import("firebase/functions");
  const app = await getFirebaseApp();
  const fns = getFunctions(app, functionsRegion());
  const fn = httpsCallable(fns, "adminSyncMatchScores");
  const res = await fn(params);
  return res.data as AdminScoreSyncResponse;
}
