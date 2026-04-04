/**
 * Callable: syncMatchFantasyScores — fetches Cricket Data API, writes iplFantasy/fantasyMatchScores.
 *
 * Secrets (set before deploy):
 *   firebase functions:secrets:set CRICKETDATA_API_KEY
 *   firebase functions:secrets:set FANTASY_SYNC_PASSPHRASE
 *
 * Optional env (Firebase console → function config or .env for emulator):
 *   CRICKETDATA_API_BASE — default https://api.cricapi.com/v1
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { demoPlayerPointsFromFantasySummary } from "./cricketdata.js";

initializeApp();

const cricketApiKey = defineSecret("CRICKETDATA_API_KEY");
const syncPassphrase = defineSecret("FANTASY_SYNC_PASSPHRASE");

const DEFAULT_API_BASE = "https://api.cricapi.com/v1";

type RosterRow = { id: string; name: string };

export const syncMatchFantasyScores = onCall(
  {
    secrets: [cricketApiKey, syncPassphrase],
    cors: true,
    region: "us-central1",
  },
  async (request) => {
    const passphrase = request.data?.passphrase;
    const cricketMatchId = request.data?.cricketMatchId;
    const matchKey = request.data?.matchKey;
    const matchLabel = request.data?.matchLabel;
    const matchDate = request.data?.matchDate;
    const players = request.data?.players as unknown;

    if (typeof passphrase !== "string" || passphrase !== syncPassphrase.value()) {
      throw new HttpsError(
        "permission-denied",
        "Invalid or missing sync passphrase.",
      );
    }

    if (typeof cricketMatchId !== "string" || !cricketMatchId.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "cricketMatchId is required (Cricket Data / CricAPI match id).",
      );
    }
    if (typeof matchKey !== "string" || !matchKey.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "matchKey is required (stable id for your league, e.g. IPL2026-M12).",
      );
    }
    if (typeof matchLabel !== "string" || !matchLabel.trim()) {
      throw new HttpsError("invalid-argument", "matchLabel is required.");
    }
    if (typeof matchDate !== "string" || !matchDate.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "matchDate is required (ISO date string).",
      );
    }

    const roster: RosterRow[] = Array.isArray(players)
      ? players
          .filter(
            (p): p is RosterRow =>
              p != null &&
              typeof p === "object" &&
              typeof (p as RosterRow).id === "string" &&
              typeof (p as RosterRow).name === "string",
          )
          .map((p) => ({ id: p.id.trim(), name: p.name.trim() }))
          .filter((p) => p.id && p.name)
      : [];

    if (roster.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "players[] is required (id + name for name matching).",
      );
    }

    const base = (
      process.env.CRICKETDATA_API_BASE || DEFAULT_API_BASE
    ).replace(/\/$/, "");
    const key = cricketApiKey.value();
    const id = cricketMatchId.trim();
    const url = `${base}/fantasySummary?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`;

    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      logger.error("Cricket API HTTP error", res.status, text.slice(0, 500));
      throw new HttpsError(
        "failed-precondition",
        `Cricket API HTTP ${res.status}. Check match id and API key.`,
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new HttpsError(
        "failed-precondition",
        "Cricket API did not return JSON.",
      );
    }

    const root = json as Record<string, unknown>;
    if (root?.status === "failure") {
      const reason = String(root?.reason ?? root?.error ?? "failure");
      throw new HttpsError("failed-precondition", `API: ${reason}`);
    }

    const playerPoints = demoPlayerPointsFromFantasySummary(json, roster);

    const mk = matchKey.trim();
    const entry = {
      matchKey: mk,
      matchLabel: matchLabel.trim(),
      matchDate: matchDate.trim(),
      status: "provisional",
      playerPoints,
      cricketMatchId: id,
      source: "cricketdata",
      scoringNote:
        "Demo scoring: batting runs summed per roster name match only. Replace with full rules engine.",
      updatedAt: FieldValue.serverTimestamp(),
    };

    const db = getFirestore();
    const ref = db.doc("iplFantasy/fantasyMatchScores");
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        matches: { [mk]: entry },
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await ref.update({
        [`matches.${mk}`]: entry,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const n = Object.keys(playerPoints).length;
    logger.info("syncMatchFantasyScores ok", { matchKey: mk, playersWithPoints: n });

    return {
      ok: true,
      message: `Saved overlay "${mk}". ${n} roster players got non-zero demo points from batting rows.`,
      playersUpdated: n,
    };
  },
);
