import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type {
  PlayerDoc,
  OwnerDoc,
  OwnershipPeriodDoc,
  MatchPlayerPointDoc,
  AppSettingsDoc,
  PlayerRole,
  PlayerNationality,
} from "../models/types.js";
import { BUDGET_START } from "../models/types.js";

interface LegacyPlayer {
  id?: string;
  name?: string;
  iplTeam?: string;
  role?: string;
  nationality?: string;
  seasonTotal?: number;
  byMatch?: { matchLabel: string; matchDate: string; points: number; matchKey?: string }[];
}

interface LegacyFranchise {
  owner: string;
  teamName: string;
  playerIds: string[];
}

interface LegacyRosterChangeEvent {
  at: string;
  roundId: number;
  orderInRound: number;
  winner: string;
  playerOutId: string;
  playerInId: string;
  effectiveAfterColumnId: string | null;
}

interface LegacyWaiverState {
  rosters?: Record<string, string[]>;
  budgets?: Record<string, number>;
  rosterHistory?: LegacyRosterChangeEvent[];
  phase?: string;
}

const VALID_ROLES: PlayerRole[] = ["BAT", "BOWL", "AR", "WK"];

function isValidRole(r: unknown): r is PlayerRole {
  return typeof r === "string" && VALID_ROLES.includes(r as PlayerRole);
}

function toNationality(v: unknown): PlayerNationality | undefined {
  if (v === "IND" || v === "OVS") return v;
  return undefined;
}

/**
 * Reads the 3 legacy Firestore docs and populates the new collection structure.
 * Idempotent: overwrites docs with the same IDs on re-run.
 */
export async function runMigration(adminSecret: string, expectedSecret: string): Promise<{
  ok: boolean;
  playerCount: number;
  ownerCount: number;
  periodCount: number;
  matchPointCount: number;
  warnings: string[];
}> {
  if (adminSecret !== expectedSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }

  const db = getFirestore();
  const warnings: string[] = [];

  // ── 1. Read legacy docs ──
  const [bundleSnap, waiverSnap, scoresSnap] = await Promise.all([
    db.doc("iplFantasy/leagueBundle").get(),
    db.doc("iplFantasy/waiverState").get(),
    db.doc("iplFantasy/fantasyMatchScores").get(),
  ]);

  const bundlePayload = bundleSnap.data()?.payload as {
    players?: LegacyPlayer[];
    waiverPool?: LegacyPlayer[];
    franchises?: LegacyFranchise[];
  } | undefined;

  const waiverData = waiverSnap.data()?.payload as LegacyWaiverState | undefined;
  const scoresData = scoresSnap.data() as {
    matches?: Record<string, {
      matchKey: string;
      matchDate: string;
      playerPoints?: Record<string, number>;
    }>;
  } | undefined;

  if (!bundlePayload?.franchises || !bundlePayload?.players) {
    throw new HttpsError(
      "failed-precondition",
      "iplFantasy/leagueBundle is missing franchises or players.",
    );
  }

  const franchises = bundlePayload.franchises;
  const rosters = waiverData?.rosters ?? {};
  const budgets = waiverData?.budgets ?? {};
  const rosterHistory = waiverData?.rosterHistory ?? [];

  // Build ownership map: playerId → owner name (from live rosters or franchise defaults)
  const ownershipMap = new Map<string, string>();
  for (const f of franchises) {
    const liveRoster = rosters[f.owner] ?? f.playerIds;
    for (const pid of liveRoster) {
      ownershipMap.set(pid, f.owner);
    }
  }

  // ── 2. Build player docs ──
  const allRawPlayers = [
    ...(bundlePayload.players ?? []),
    ...(bundlePayload.waiverPool ?? []),
  ];
  const seenPlayerIds = new Set<string>();
  const playerDocs: PlayerDoc[] = [];

  for (const raw of allRawPlayers) {
    if (!raw.id || !raw.name || !raw.iplTeam || !isValidRole(raw.role)) continue;
    if (seenPlayerIds.has(raw.id)) continue;
    seenPlayerIds.add(raw.id);

    const owner = ownershipMap.get(raw.id) ?? null;
    playerDocs.push({
      id: raw.id,
      name: raw.name,
      iplTeam: raw.iplTeam,
      role: raw.role,
      nationality: toNationality(raw.nationality),
      isOwned: owner !== null,
      currentOwnerId: owner,
      seasonTotal: raw.seasonTotal ?? 0,
      byMatch: (raw.byMatch ?? []).map((m) => ({
        matchLabel: m.matchLabel,
        matchDate: m.matchDate,
        points: m.points,
        ...(m.matchKey ? { matchKey: m.matchKey } : {}),
      })),
    });
  }

  // ── 3. Build owner docs ──
  const ownerDocs: OwnerDoc[] = franchises.map((f) => ({
    owner: f.owner,
    teamName: f.teamName,
    squad: rosters[f.owner] ?? [...f.playerIds],
    remainingBudget: budgets[f.owner] ?? BUDGET_START,
  }));

  // ── 4. Build ownership periods from rosterHistory ──
  //
  // For each franchise's auction roster, create an initial period (acquiredAt = season start).
  // Then replay rosterHistory to close/open periods for swaps.
  const periods: OwnershipPeriodDoc[] = [];
  let periodSeq = 0;

  // Map from matchDate strings so we can resolve effectiveAfterColumnId to a timestamp.
  // Collect all match dates from player byMatch entries.
  const matchDatesByColumnId = new Map<string, string>();
  for (const p of playerDocs) {
    for (const m of p.byMatch) {
      const colId = m.matchKey ?? `${m.matchDate}\x1f${m.matchLabel}`;
      if (!matchDatesByColumnId.has(colId)) {
        matchDatesByColumnId.set(colId, m.matchDate);
      }
    }
  }

  function resolveTimestampForColumnId(colId: string | null): string {
    if (!colId) return "2026-03-01T00:00:00.000Z";
    return matchDatesByColumnId.get(colId) ?? "2026-03-01T00:00:00.000Z";
  }

  const SEASON_START = "2026-03-21T00:00:00.000Z";

  // Initial auction periods: every player on the original franchise roster
  const auctionRosters = new Map<string, Set<string>>();
  for (const f of franchises) {
    auctionRosters.set(f.owner, new Set(f.playerIds));
  }

  // Track active periods per (owner, playerId)
  const activePeriods = new Map<string, OwnershipPeriodDoc>();

  function periodKey(ownerId: string, playerId: string): string {
    return `${ownerId}::${playerId}`;
  }

  // Create initial periods for auction rosters
  for (const f of franchises) {
    for (const pid of f.playerIds) {
      const doc: OwnershipPeriodDoc = {
        periodId: `period-${++periodSeq}`,
        playerId: pid,
        ownerId: f.owner,
        acquiredAt: SEASON_START,
        releasedAt: null,
      };
      periods.push(doc);
      activePeriods.set(periodKey(f.owner, pid), doc);
    }
  }

  // Sort rosterHistory by effective time
  const sortedHistory = [...rosterHistory].sort((a, b) => {
    const ta = resolveTimestampForColumnId(a.effectiveAfterColumnId);
    const tb = resolveTimestampForColumnId(b.effectiveAfterColumnId);
    if (ta !== tb) return ta.localeCompare(tb);
    if (a.roundId !== b.roundId) return a.roundId - b.roundId;
    return a.orderInRound - b.orderInRound;
  });

  for (const ev of sortedHistory) {
    const swapTime = ev.at || resolveTimestampForColumnId(ev.effectiveAfterColumnId);

    // Close the winner's out-player period
    const outKey = periodKey(ev.winner, ev.playerOutId);
    const outPeriod = activePeriods.get(outKey);
    if (outPeriod) {
      outPeriod.releasedAt = swapTime;
      activePeriods.delete(outKey);
    } else {
      warnings.push(
        `Migration: no active period for ${ev.winner}/${ev.playerOutId} to close at round ${ev.roundId}.`,
      );
    }

    // Create new period for the winner's acquired player
    const inDoc: OwnershipPeriodDoc = {
      periodId: `period-${++periodSeq}`,
      playerId: ev.playerInId,
      ownerId: ev.winner,
      acquiredAt: swapTime,
      releasedAt: null,
    };
    periods.push(inDoc);
    activePeriods.set(periodKey(ev.winner, ev.playerInId), inDoc);
  }

  // ── 5. Build matchPlayerPoints from fantasyMatchScores ──
  const matchPointDocs: MatchPlayerPointDoc[] = [];
  const matches = scoresData?.matches ?? {};
  for (const [, entry] of Object.entries(matches)) {
    if (!entry.matchKey || !entry.playerPoints) continue;
    for (const [playerId, points] of Object.entries(entry.playerPoints)) {
      matchPointDocs.push({
        recordId: `${entry.matchKey}_${playerId}`,
        playerId,
        matchId: entry.matchKey,
        matchPlayedAt: entry.matchDate,
        points: typeof points === "number" ? points : 0,
      });
    }
  }

  // ── 6. Build appSettings ──
  const phase = waiverData?.phase;
  const appSettings: AppSettingsDoc = {
    isWaiverWindowOpen: phase === "nomination" || phase === "bidding",
    waiverPhase: (phase === "nomination" || phase === "bidding") ? phase : "idle",
  };

  // ── 7. Write to Firestore in batches (max 500 ops per batch) ──
  const MAX_BATCH = 490;

  async function writeBatched(
    ops: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[],
  ): Promise<void> {
    for (let i = 0; i < ops.length; i += MAX_BATCH) {
      const batch = db.batch();
      for (const op of ops.slice(i, i + MAX_BATCH)) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
  }

  const allOps: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];

  for (const p of playerDocs) {
    allOps.push({ ref: db.collection("players").doc(p.id), data: { ...p } as unknown as Record<string, unknown> });
  }
  for (const o of ownerDocs) {
    allOps.push({ ref: db.collection("owners").doc(o.owner), data: { ...o } as unknown as Record<string, unknown> });
  }
  for (const p of periods) {
    allOps.push({ ref: db.collection("ownershipPeriods").doc(p.periodId), data: { ...p } as unknown as Record<string, unknown> });
  }
  for (const m of matchPointDocs) {
    allOps.push({ ref: db.collection("matchPlayerPoints").doc(m.recordId), data: { ...m } as unknown as Record<string, unknown> });
  }
  allOps.push({ ref: db.doc("appSettings/league"), data: { ...appSettings } as unknown as Record<string, unknown> });

  await writeBatched(allOps);

  return {
    ok: true,
    playerCount: playerDocs.length,
    ownerCount: ownerDocs.length,
    periodCount: periods.length,
    matchPointCount: matchPointDocs.length,
    warnings,
  };
}
