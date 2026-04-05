import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type {
  AppSettingsDoc,
  OwnerDoc,
  PlayerDoc,
  WaiverNominationDoc,
  WaiverBidDoc,
  OwnershipPeriodDoc,
  WaiverPhase,
} from "../models/types.js";
import { validateSquadComposition } from "../validation/squadComposition.js";

// ─── helpers ───

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

async function readSettings(
  db: FirebaseFirestore.Firestore,
): Promise<AppSettingsDoc> {
  const snap = await db.doc("appSettings/league").get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "App settings not initialized. Run migration first.");
  }
  return snap.data() as AppSettingsDoc;
}

function assertWaiverOpen(settings: AppSettingsDoc): void {
  if (!settings.isWaiverWindowOpen) {
    throw new HttpsError("failed-precondition", "Waiver window is closed.");
  }
}

function assertPhase(settings: AppSettingsDoc, expected: WaiverPhase): void {
  if (settings.waiverPhase !== expected) {
    throw new HttpsError(
      "failed-precondition",
      `Expected waiver phase "${expected}", currently "${settings.waiverPhase}".`,
    );
  }
}

// ─── NOMINATE ───

export interface NominateInput {
  ownerPassword: string;
  ownerName: string;
  nominatedPlayerId: string;
  playerToDropId: string;
}

export async function handleNominate(data: NominateInput): Promise<{ nominationId: string }> {
  const db = getFirestore();

  const settings = await readSettings(db);
  assertWaiverOpen(settings);
  assertPhase(settings, "nomination");

  const { ownerName, nominatedPlayerId, playerToDropId } = data;

  // Validate owner exists
  const ownerSnap = await db.collection("owners").doc(ownerName).get();
  if (!ownerSnap.exists) {
    throw new HttpsError("not-found", `Owner "${ownerName}" not found.`);
  }
  const owner = ownerSnap.data() as OwnerDoc;

  // Validate player to drop is on owner's squad
  if (!owner.squad.includes(playerToDropId)) {
    throw new HttpsError(
      "invalid-argument",
      `Player "${playerToDropId}" is not on your squad.`,
    );
  }

  // Validate nominated player is not owned
  const nomineeSnap = await db.collection("players").doc(nominatedPlayerId).get();
  if (!nomineeSnap.exists) {
    throw new HttpsError("not-found", `Player "${nominatedPlayerId}" not found.`);
  }
  const nominee = nomineeSnap.data() as PlayerDoc;
  if (nominee.isOwned) {
    throw new HttpsError(
      "invalid-argument",
      `Player "${nominee.name}" is already owned by ${nominee.currentOwnerId}.`,
    );
  }

  // Double nomination guard
  const openNoms = await db
    .collection("waiverNominations")
    .where("nominatedPlayerId", "==", nominatedPlayerId)
    .where("status", "==", "OPEN")
    .limit(1)
    .get();
  if (!openNoms.empty) {
    throw new HttpsError(
      "already-exists",
      `An open nomination already exists for "${nominee.name}".`,
    );
  }

  const nominationId = newId("nom");
  const doc: WaiverNominationDoc = {
    nominationId,
    nominatedPlayerId,
    nominatedByOwnerId: ownerName,
    playerToDropId,
    status: "OPEN",
    nominatedAt: nowIso(),
    closedAt: null,
  };

  await db.collection("waiverNominations").doc(nominationId).set(doc);
  return { nominationId };
}

// ─── BID ───

export interface BidInput {
  ownerPassword: string;
  ownerName: string;
  nominationId: string;
  bidAmount: number;
  playerToDropId?: string;
}

export async function handleBid(data: BidInput): Promise<{ bidId: string }> {
  const db = getFirestore();

  const settings = await readSettings(db);
  assertWaiverOpen(settings);
  assertPhase(settings, "bidding");

  const { ownerName, nominationId, bidAmount, playerToDropId } = data;

  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    throw new HttpsError("invalid-argument", "Bid amount must be a positive number.");
  }

  // Read nomination
  const nomSnap = await db.collection("waiverNominations").doc(nominationId).get();
  if (!nomSnap.exists) {
    throw new HttpsError("not-found", `Nomination "${nominationId}" not found.`);
  }
  const nom = nomSnap.data() as WaiverNominationDoc;
  if (nom.status !== "OPEN") {
    throw new HttpsError("failed-precondition", "Nomination is not open.");
  }

  // Read owner
  const ownerSnap = await db.collection("owners").doc(ownerName).get();
  if (!ownerSnap.exists) {
    throw new HttpsError("not-found", `Owner "${ownerName}" not found.`);
  }
  const owner = ownerSnap.data() as OwnerDoc;

  // Budget check
  if (bidAmount > owner.remainingBudget) {
    throw new HttpsError(
      "invalid-argument",
      `Bid ${bidAmount} exceeds remaining budget ${owner.remainingBudget}.`,
    );
  }

  // Non-nominating owner must specify playerToDropId
  const isNominator = ownerName === nom.nominatedByOwnerId;
  const dropId = isNominator ? nom.playerToDropId : playerToDropId;

  if (!isNominator && !playerToDropId) {
    throw new HttpsError(
      "invalid-argument",
      "Non-nominating bidders must specify a playerToDropId.",
    );
  }

  if (dropId && !owner.squad.includes(dropId)) {
    throw new HttpsError(
      "invalid-argument",
      `Player "${dropId}" is not on your squad.`,
    );
  }

  // Upsert: find existing bid by (nominationId + ownerName)
  const existingQuery = await db
    .collection("waiverBids")
    .where("nominationId", "==", nominationId)
    .where("ownerId", "==", ownerName)
    .limit(1)
    .get();

  let bidId: string;
  if (!existingQuery.empty) {
    bidId = existingQuery.docs[0].id;
    await db.collection("waiverBids").doc(bidId).update({
      bidAmount,
      playerToDropId: dropId ?? FieldValue.delete(),
      bidPlacedAt: nowIso(),
    });
  } else {
    bidId = newId("bid");
    const bidDoc: WaiverBidDoc = {
      bidId,
      nominationId,
      ownerId: ownerName,
      bidAmount,
      ...(dropId ? { playerToDropId: dropId } : {}),
      bidPlacedAt: nowIso(),
      isWinningBid: false,
    };
    await db.collection("waiverBids").doc(bidId).set(bidDoc);
  }

  return { bidId };
}

// ─── SETTLE ───

export interface SettleInput {
  adminSecret: string;
  nominationId: string;
}

interface SettleResult {
  ok: boolean;
  outcome: "won" | "cancelled";
  winnerId?: string;
  bidAmount?: number;
  skippedBids: { ownerId: string; reason: string }[];
}

export async function handleSettle(
  data: SettleInput,
  expectedSecret: string,
): Promise<SettleResult> {
  if (data.adminSecret !== expectedSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }

  const db = getFirestore();
  const { nominationId } = data;

  // Read nomination
  const nomSnap = await db.collection("waiverNominations").doc(nominationId).get();
  if (!nomSnap.exists) {
    throw new HttpsError("not-found", `Nomination "${nominationId}" not found.`);
  }
  const nom = nomSnap.data() as WaiverNominationDoc;
  if (nom.status !== "OPEN") {
    throw new HttpsError("failed-precondition", "Nomination is not open.");
  }

  // Collect all bids (the nominator's bid is implicit from the nomination amount if they placed one)
  const bidsSnap = await db
    .collection("waiverBids")
    .where("nominationId", "==", nominationId)
    .get();

  const allBids = bidsSnap.docs.map((d) => d.data() as WaiverBidDoc);

  if (allBids.length === 0) {
    await db.collection("waiverNominations").doc(nominationId).update({
      status: "CANCELLED",
      closedAt: nowIso(),
    });
    return { ok: true, outcome: "cancelled", skippedBids: [] };
  }

  // Sort: highest bid first, earliest placement wins ties
  allBids.sort((a, b) => {
    if (b.bidAmount !== a.bidAmount) return b.bidAmount - a.bidAmount;
    return a.bidPlacedAt.localeCompare(b.bidPlacedAt);
  });

  const skippedBids: { ownerId: string; reason: string }[] = [];

  // Iterate to find first valid winner
  for (const bid of allBids) {
    const isNominator = bid.ownerId === nom.nominatedByOwnerId;
    const dropId = isNominator ? nom.playerToDropId : bid.playerToDropId;

    // Non-nominator must have a drop player
    if (!isNominator && !dropId) {
      skippedBids.push({ ownerId: bid.ownerId, reason: "No playerToDropId specified." });
      continue;
    }

    // Budget re-check
    const ownerSnap = await db.collection("owners").doc(bid.ownerId).get();
    if (!ownerSnap.exists) {
      skippedBids.push({ ownerId: bid.ownerId, reason: "Owner not found." });
      continue;
    }
    const owner = ownerSnap.data() as OwnerDoc;

    if (bid.bidAmount > owner.remainingBudget) {
      skippedBids.push({
        ownerId: bid.ownerId,
        reason: `Bid ${bid.bidAmount} exceeds budget ${owner.remainingBudget}.`,
      });
      continue;
    }

    // Simulate post-transfer squad
    if (dropId && !owner.squad.includes(dropId)) {
      skippedBids.push({
        ownerId: bid.ownerId,
        reason: `Drop player "${dropId}" not on squad.`,
      });
      continue;
    }

    const simulatedSquadIds = owner.squad
      .filter((id) => id !== dropId)
      .concat(nom.nominatedPlayerId);

    // Read player docs for validation
    const playerSnaps = await Promise.all(
      simulatedSquadIds.map((id) => db.collection("players").doc(id).get()),
    );
    const simulatedPlayers: PlayerDoc[] = [];
    let missingPlayer = false;
    for (const ps of playerSnaps) {
      if (!ps.exists) {
        missingPlayer = true;
        break;
      }
      simulatedPlayers.push(ps.data() as PlayerDoc);
    }
    if (missingPlayer) {
      skippedBids.push({ ownerId: bid.ownerId, reason: "Missing player data for validation." });
      continue;
    }

    const validation = validateSquadComposition(simulatedPlayers);
    if (!validation.valid) {
      skippedBids.push({
        ownerId: bid.ownerId,
        reason: `Squad invalid: ${validation.errors.join("; ")}`,
      });
      continue;
    }

    // ── This bid wins. Execute atomically. ──
    const now = nowIso();
    const batch = db.batch();

    // 1. Mark winning bid
    batch.update(db.collection("waiverBids").doc(bid.bidId), {
      isWinningBid: true,
    });

    // 2. Deduct budget
    batch.update(db.collection("owners").doc(bid.ownerId), {
      remainingBudget: owner.remainingBudget - bid.bidAmount,
      squad: simulatedSquadIds,
    });

    // 3. Drop the out-player: close active ownership period
    if (dropId) {
      const activePeriodSnap = await db
        .collection("ownershipPeriods")
        .where("playerId", "==", dropId)
        .where("ownerId", "==", bid.ownerId)
        .where("releasedAt", "==", null)
        .limit(1)
        .get();
      if (!activePeriodSnap.empty) {
        batch.update(activePeriodSnap.docs[0].ref, { releasedAt: now });
      }

      // Update dropped player doc
      batch.update(db.collection("players").doc(dropId), {
        isOwned: false,
        currentOwnerId: null,
      });
    }

    // 4. Acquire nominated player: new ownership period
    const periodId = newId("period");
    const newPeriod: OwnershipPeriodDoc = {
      periodId,
      playerId: nom.nominatedPlayerId,
      ownerId: bid.ownerId,
      acquiredAt: now,
      releasedAt: null,
    };
    batch.set(db.collection("ownershipPeriods").doc(periodId), newPeriod);

    // Update acquired player doc
    batch.update(db.collection("players").doc(nom.nominatedPlayerId), {
      isOwned: true,
      currentOwnerId: bid.ownerId,
    });

    // 5. Close nomination
    batch.update(db.collection("waiverNominations").doc(nominationId), {
      status: "CLOSED",
      closedAt: now,
    });

    // 6. Legacy backward-compat: append to waiverState.rosterHistory
    const waiverStateRef = db.doc("iplFantasy/waiverState");
    const wsSnap = await waiverStateRef.get();
    if (wsSnap.exists) {
      const payload = wsSnap.data()?.payload as Record<string, unknown> | undefined;
      const existingHistory = (payload?.rosterHistory as unknown[]) ?? [];
      const rosterEvent = {
        at: now,
        roundId: 0,
        orderInRound: 0,
        winner: bid.ownerId,
        playerOutId: dropId ?? "",
        playerInId: nom.nominatedPlayerId,
        effectiveAfterColumnId: null,
      };
      batch.set(
        waiverStateRef,
        { payload: { rosterHistory: [...existingHistory, rosterEvent] } },
        { merge: true },
      );
    }

    await batch.commit();

    return {
      ok: true,
      outcome: "won",
      winnerId: bid.ownerId,
      bidAmount: bid.bidAmount,
      skippedBids,
    };
  }

  // No valid winner
  await db.collection("waiverNominations").doc(nominationId).update({
    status: "CANCELLED",
    closedAt: nowIso(),
  });

  return { ok: true, outcome: "cancelled", skippedBids };
}

// ─── SET WAIVER PHASE ───

export interface SetPhaseInput {
  adminSecret: string;
  targetPhase: WaiverPhase;
}

export async function handleSetWaiverPhase(
  data: SetPhaseInput,
  expectedSecret: string,
): Promise<{ phase: WaiverPhase; isWaiverWindowOpen: boolean }> {
  if (data.adminSecret !== expectedSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }

  const db = getFirestore();
  const settings = await readSettings(db);
  const { targetPhase } = data;

  // Validate state machine transitions
  const validTransitions: Record<WaiverPhase, WaiverPhase[]> = {
    idle: ["nomination"],
    nomination: ["bidding"],
    bidding: ["idle"],
  };

  const allowed = validTransitions[settings.waiverPhase];
  if (!allowed || !allowed.includes(targetPhase)) {
    throw new HttpsError(
      "failed-precondition",
      `Cannot transition from "${settings.waiverPhase}" to "${targetPhase}". ` +
        `Allowed: ${(allowed ?? []).join(", ") || "none"}.`,
    );
  }

  const isWaiverWindowOpen = targetPhase !== "idle";

  await db.doc("appSettings/league").update({
    waiverPhase: targetPhase,
    isWaiverWindowOpen,
  });

  return { phase: targetPhase, isWaiverWindowOpen };
}
