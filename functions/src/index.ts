import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { runAdminScoreSync } from "./sync/adminScoreSync.js";

initializeApp();

/** Must match web app `ADMIN_SCORE_SYNC_SECRET` in `adminScoreSyncCall.ts`. */
const ADMIN_SCORE_SYNC_SECRET = "ViratAnushka";

/** Region must match VITE_FIREBASE_FUNCTIONS_REGION in the web app. */
const SYNC_REGION = "asia-south1";

export const adminSyncMatchScores = onCall(
  {
    region: SYNC_REGION,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const raw = request.data as Record<string, unknown> | undefined;
    const token = typeof raw?.adminSyncSecret === "string" ? raw.adminSyncSecret : "";
    if (token !== ADMIN_SCORE_SYNC_SECRET) {
      throw new HttpsError("permission-denied", "Invalid or missing score-sync secret.");
    }
    const matchQuery = typeof raw?.matchQuery === "string" ? raw.matchQuery.trim() : "";
    if (!matchQuery) {
      throw new HttpsError("invalid-argument", "matchQuery is required.");
    }
    const matchDateYmd =
      typeof raw?.matchDateYmd === "string" ? raw.matchDateYmd.trim() : "";
    if (!matchDateYmd) {
      throw new HttpsError("invalid-argument", "matchDateYmd is required (YYYY-MM-DD).");
    }
    const writeToFirestore = raw?.writeToFirestore === true;
    try {
      return await runAdminScoreSync({ matchQuery, matchDateYmd, writeToFirestore });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("adminSyncMatchScores failed", msg, e);
      const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
      throw new HttpsError(
        "failed-precondition",
        short || "Score sync failed (check Cloud Function logs).",
      );
    }
  },
);

/** Clears all per-match overlay rows in `iplFantasy/fantasyMatchScores` (same secret as score sync). */
export const adminResetFantasyMatchScores = onCall(
  {
    region: SYNC_REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    const raw = request.data as Record<string, unknown> | undefined;
    const token = typeof raw?.adminSyncSecret === "string" ? raw.adminSyncSecret : "";
    if (token !== ADMIN_SCORE_SYNC_SECRET) {
      throw new HttpsError("permission-denied", "Invalid or missing score-sync secret.");
    }
    const db = getFirestore();
    await db.doc("iplFantasy/fantasyMatchScores").set({ matches: {} });
    return {
      ok: true,
      message:
        "Firestore iplFantasy/fantasyMatchScores: all match overlays removed. Republish league from Waivers if player totals in leagueBundle should match static JSON.",
    };
  },
);
