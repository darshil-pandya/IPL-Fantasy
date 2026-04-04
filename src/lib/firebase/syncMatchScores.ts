import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, isFirebaseConfigured } from "./client";

export type SyncMatchScoresRequest = {
  passphrase: string;
  cricketMatchId: string;
  matchKey: string;
  matchLabel: string;
  matchDate: string;
  players: { id: string; name: string }[];
};

export type SyncMatchScoresResponse = {
  ok?: boolean;
  message?: string;
  playersUpdated?: number;
};

export async function callSyncMatchFantasyScores(
  body: SyncMatchScoresRequest,
): Promise<SyncMatchScoresResponse> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured.");
  }
  const app = await getFirebaseApp();
  const region =
    import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || "us-central1";
  const functions = getFunctions(app, region);
  const fn = httpsCallable<
    SyncMatchScoresRequest,
    SyncMatchScoresResponse
  >(functions, "syncMatchFantasyScores");
  const res = await fn(body);
  return res.data ?? {};
}
