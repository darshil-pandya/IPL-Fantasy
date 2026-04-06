import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { runAdminScoreSync } from "./sync/adminScoreSync.js";
import {
  runMigration,
  runResetWaiverActivityToAuctionBaseline,
} from "./api/migrate.js";
import {
  handleNominate,
  handleBid,
  handleSettle,
  handleSetWaiverPhase,
  type NominateInput,
  type BidInput,
  type SettleInput,
  type SetPhaseInput,
} from "./api/waivers.js";
import {
  handleGetPlayers,
  handleGetPlayerHistory,
  type GetPlayerHistoryInput,
} from "./api/players.js";
import {
  handleGetOwnerPoints,
  handleGetOwnerSquad,
  handleGetLeaderboard,
  type GetOwnerPointsInput,
  type GetOwnerSquadInput,
} from "./api/owners.js";
import { buildApril2026WaiverPayload } from "./backfill/backfillWaiverFromMatches.js";
import { patchMatchPlayerPointsAttribution } from "./backfill/patchMatchPlayerPointsAttribution.js";
import { deleteCollectionBatched } from "./backfill/deleteCollectionBatched.js";

initializeApp();

/** Must match web app `ADMIN_SCORE_SYNC_SECRET` in `adminScoreSyncCall.ts`. */
const ADMIN_SCORE_SYNC_SECRET = "ViratAnushka";

/** Region must match VITE_FIREBASE_FUNCTIONS_REGION in the web app. */
const SYNC_REGION = "asia-south1";

const CALLABLE_OPTS = { region: SYNC_REGION, timeoutSeconds: 60, memory: "256MiB" as const };
const HEAVY_CALLABLE_OPTS = { region: SYNC_REGION, timeoutSeconds: 120, memory: "512MiB" as const };

// ═══════════════════════════════════════════════════════════
// Existing score-sync functions (unchanged API contract)
// ═══════════════════════════════════════════════════════════

export const adminSyncMatchScores = onCall(
  HEAVY_CALLABLE_OPTS,
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

export const adminResetFantasyMatchScores = onCall(
  CALLABLE_OPTS,
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

// ═══════════════════════════════════════════════════════════
// Migration
// ═══════════════════════════════════════════════════════════

export const adminMigrateToCollections = onCall(
  HEAVY_CALLABLE_OPTS,
  async (request) => {
    const raw = request.data as Record<string, unknown> | undefined;
    const secret = typeof raw?.adminSecret === "string" ? raw.adminSecret : "";
    return await runMigration(secret, ADMIN_SCORE_SYNC_SECRET);
  },
);

export const adminResetWaiverActivity = onCall(
  HEAVY_CALLABLE_OPTS,
  async (request) => {
    const raw = request.data as Record<string, unknown> | undefined;
    const secret = typeof raw?.adminSecret === "string" ? raw.adminSecret : "";
    return await runResetWaiverActivityToAuctionBaseline(
      secret,
      ADMIN_SCORE_SYNC_SECRET,
    );
  },
);

/**
 * Backfills `iplFantasy/waiverState` from auction `leagueBundle` + chronological
 * `fantasyMatchScores` matches (≥9) using the April 2026 offline timeline in
 * `backfill/april2026Transfers.ts`. Optionally re-runs migration and patches
 * `matchPlayerPoints.matchPlayedAt` for cloud attribution parity.
 */
export const adminBackfillApril2026WaiverTimeline = onCall(
  HEAVY_CALLABLE_OPTS,
  async (request) => {
    const raw = request.data as Record<string, unknown> | undefined;
    const secret = typeof raw?.adminSecret === "string" ? raw.adminSecret : "";
    if (secret !== ADMIN_SCORE_SYNC_SECRET) {
      throw new HttpsError("permission-denied", "Invalid admin secret.");
    }

    const patchMpp = raw?.patchMatchPlayerPointsAttribution !== false;
    const runMigrate = raw?.runMigrationAfter === true;
    const clearCompletedTransfers = raw?.clearCompletedTransfers !== false;

    const db = getFirestore();

    const bundleSnap = await db.doc("iplFantasy/leagueBundle").get();
    const bundlePayload = bundleSnap.data()?.payload as
      | { franchises?: { owner: string; teamName: string; playerIds: string[] }[] }
      | undefined;
    if (!bundlePayload?.franchises?.length) {
      throw new HttpsError(
        "failed-precondition",
        "iplFantasy/leagueBundle is missing franchises.",
      );
    }

    const scoresSnap = await db.doc("iplFantasy/fantasyMatchScores").get();
    const matches = (scoresSnap.data()?.matches ?? {}) as Record<
      string,
      Record<string, unknown>
    >;

    const built = buildApril2026WaiverPayload(bundlePayload.franchises, matches);
    if (!built.ok) {
      throw new HttpsError("failed-precondition", built.error);
    }

    let deletedTransfers = 0;
    if (clearCompletedTransfers) {
      deletedTransfers = await deleteCollectionBatched(db, "completedTransfers");
    }

    await db.doc("iplFantasy/waiverState").set({
      payload: built.payload,
      updatedAt: FieldValue.serverTimestamp(),
    });

    let migrationResult: Awaited<ReturnType<typeof runMigration>> | null = null;
    if (runMigrate) {
      migrationResult = await runMigration(secret, ADMIN_SCORE_SYNC_SECRET);
    }

    let matchPlayerPointsPatched: { updated: number } | null = null;
    if (patchMpp) {
      matchPlayerPointsPatched = await patchMatchPlayerPointsAttribution(
        db,
        built.orderedMatches,
      );
    }

    return {
      ok: true,
      warnings: built.warnings,
      orderedMatchLabels: built.orderedMatches.map(
        (m) => `${m.matchDate.slice(0, 10)} ${m.matchLabel}`,
      ),
      deletedCompletedTransfers: deletedTransfers,
      migrationResult,
      matchPlayerPointsPatched,
    };
  },
);

// ═══════════════════════════════════════════════════════════
// Waiver mutations
// ═══════════════════════════════════════════════════════════

export const waiverNominate = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as NominateInput;
    return await handleNominate(data);
  },
);

export const waiverBid = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as BidInput;
    return await handleBid(data);
  },
);

export const waiverSettle = onCall(
  HEAVY_CALLABLE_OPTS,
  async (request) => {
    const data = request.data as SettleInput;
    return await handleSettle(data, ADMIN_SCORE_SYNC_SECRET);
  },
);

export const adminSetWaiverPhase = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as SetPhaseInput;
    return await handleSetWaiverPhase(data, ADMIN_SCORE_SYNC_SECRET);
  },
);

// ═══════════════════════════════════════════════════════════
// Read endpoints
// ═══════════════════════════════════════════════════════════

export const getPlayers = onCall(
  CALLABLE_OPTS,
  async () => {
    return await handleGetPlayers();
  },
);

export const getPlayerHistory = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as GetPlayerHistoryInput;
    return await handleGetPlayerHistory(data);
  },
);

export const getOwnerPoints = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as GetOwnerPointsInput;
    return await handleGetOwnerPoints(data);
  },
);

export const getOwnerSquad = onCall(
  CALLABLE_OPTS,
  async (request) => {
    const data = request.data as GetOwnerSquadInput;
    return await handleGetOwnerSquad(data);
  },
);

export const getLeaderboard = onCall(
  CALLABLE_OPTS,
  async () => {
    return await handleGetLeaderboard();
  },
);
