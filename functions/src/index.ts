import { initializeApp } from "firebase-admin/app";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { runAdminScoreSync } from "./sync/adminScoreSync.js";

initializeApp();

const adminScoreSyncSecret = defineSecret("ADMIN_SCORE_SYNC_SECRET");

/** Region must match VITE_FIREBASE_FUNCTIONS_REGION in the web app. */
const SYNC_REGION = "asia-south1";

export const adminSyncMatchScores = onCall(
  {
    region: SYNC_REGION,
    secrets: [adminScoreSyncSecret],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const expected = adminScoreSyncSecret.value();
    const raw = request.data as Record<string, unknown> | undefined;
    const token = typeof raw?.adminSyncSecret === "string" ? raw.adminSyncSecret : "";
    if (!expected || token !== expected) {
      throw new HttpsError("permission-denied", "Invalid or missing score-sync secret.");
    }
    const matchQuery = typeof raw?.matchQuery === "string" ? raw.matchQuery.trim() : "";
    if (!matchQuery) {
      throw new HttpsError("invalid-argument", "matchQuery is required.");
    }
    const writeToFirestore = raw?.writeToFirestore === true;
    return runAdminScoreSync({ matchQuery, writeToFirestore });
  },
);
