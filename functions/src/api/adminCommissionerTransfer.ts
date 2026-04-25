import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { OwnerDoc, PlayerDoc } from "../models/types.js";
import { applyWaiverPlayerSwap, newId, nowIso } from "../waiver/applyWaiverSwap.js";
import { resolveDefaultEffectiveAfterColumnId } from "./waiverReveal.js";
import type {
  CompletedTransferPort,
  RosterChangeEventPort,
  WaiverLogEntryPort,
  WaiverPersistentStatePort,
} from "../waiver/revealResolve.js";

const WAIVER_STATE_DOC = "iplFantasy/waiverState";

function parseWaiverPayload(
  data: FirebaseFirestore.DocumentData | undefined,
): Record<string, unknown> {
  const p = data?.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return { ...(p as Record<string, unknown>) };
  }
  return {};
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asWaiverState(
  payload: Record<string, unknown>,
): WaiverPersistentStatePort | null {
  if (payload.version !== 2) return null;
  if (typeof payload.roundId !== "number") return null;
  if (typeof payload.phase !== "string") return null;
  if (!payload.rosters || typeof payload.rosters !== "object") return null;
  if (!payload.budgets || typeof payload.budgets !== "object") return null;
  if (!Array.isArray(payload.rosterHistory)) return null;
  if (!Array.isArray(payload.nominations)) return null;
  if (!Array.isArray(payload.bids)) return null;
  if (!Array.isArray(payload.log)) return null;
  return payload as unknown as WaiverPersistentStatePort;
}

function logEntry(
  kind: string,
  message: string,
  meta?: Record<string, unknown>,
): WaiverLogEntryPort {
  const at = nowIso();
  if (meta == null) return { at, kind, message };
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return { at, kind, message };
  return { at, kind, message, meta: cleaned };
}

export interface AdminCommissionerTransferInput {
  adminSecret: string;
  targetOwnerName: string;
  playerInId: string;
  playerOutId: string;
  effectiveAfterColumnId?: string | null;
}

export interface AdminCommissionerTransferResult {
  ok: true;
  transferId: string;
  appliedAt: string;
}

/**
 * Authoritative squad swap for ₹0 (no budget change), any waiver phase, no round/window rules.
 * Updates `owners` / `players` / `ownershipPeriods` via `applyWaiverPlayerSwap`, then
 * `iplFantasy/waiverState` rosters + log + `rosterHistory`, and a `completedTransfers` doc.
 */
export async function handleAdminCommissionerTransfer(
  data: AdminCommissionerTransferInput,
  expectedSecret: string,
): Promise<AdminCommissionerTransferResult> {
  if (data.adminSecret !== expectedSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }

  const targetOwnerName =
    typeof data.targetOwnerName === "string" ? data.targetOwnerName.trim() : "";
  const playerInId = typeof data.playerInId === "string" ? data.playerInId.trim() : "";
  const playerOutId = typeof data.playerOutId === "string" ? data.playerOutId.trim() : "";
  if (!targetOwnerName || !playerInId || !playerOutId) {
    throw new HttpsError(
      "invalid-argument",
      "targetOwnerName, playerInId, and playerOutId are required.",
    );
  }

  const db = getFirestore();
  const ownerSnap = await db.collection("owners").doc(targetOwnerName).get();
  if (!ownerSnap.exists) {
    throw new HttpsError("not-found", `Owner "${targetOwnerName}" not found.`);
  }
  const owner = ownerSnap.data() as OwnerDoc;
  if (!owner.squad.includes(playerOutId)) {
    throw new HttpsError(
      "invalid-argument",
      `Player "${playerOutId}" is not on ${targetOwnerName}'s squad.`,
    );
  }

  const nomineeSnap = await db.collection("players").doc(playerInId).get();
  if (!nomineeSnap.exists) {
    throw new HttpsError("not-found", `Player "${playerInId}" not found.`);
  }
  const nominee = nomineeSnap.data() as PlayerDoc;
  if (nominee.isOwned) {
    throw new HttpsError(
      "invalid-argument",
      `Player "${nominee.name}" is already owned by ${nominee.currentOwnerId}.`,
    );
  }

  const effectiveRaw = data.effectiveAfterColumnId;
  const effectiveAfterColumnId =
    typeof effectiveRaw === "string" && effectiveRaw.trim()
      ? effectiveRaw.trim()
      : (await resolveDefaultEffectiveAfterColumnId(db));

  const { now, simulatedSquadIds } = await applyWaiverPlayerSwap(db, {
    winnerId: targetOwnerName,
    playerInId,
    playerOutId,
    bidAmount: 0,
    timestampsAt: nowIso(),
    effectiveAfterColumnId,
  });

  const waiverRef = db.doc(WAIVER_STATE_DOC);
  const transferId = newId("ct");
  const completedTransfer: CompletedTransferPort = {
    id: transferId,
    roundId: 0,
    revealedAt: now,
    playerInId,
    nominatorOwner: targetOwnerName,
    bids: [
      {
        owner: targetOwnerName,
        amount: 0,
        playerOutId,
        placedAt: now,
        result: "WON",
      },
    ],
    effectiveAfterColumnId: effectiveAfterColumnId ?? null,
  };

  const wsSnap = await waiverRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Waiver state document is missing. Cannot update embedded rosters after swap.",
    );
  }
  const rawPayload = parseWaiverPayload(wsSnap.data());
  const parsed = asWaiverState(rawPayload);
  if (!parsed) {
    throw new HttpsError(
      "failed-precondition",
      "Waiver payload is invalid or not version 2; cannot update after commissioner transfer.",
    );
  }

  const rosters = { ...parsed.rosters, [targetOwnerName]: [...simulatedSquadIds] };
  const round0 = parsed.rosterHistory.filter((e) => e.roundId === 0);
  const maxOrder0 =
    round0.length === 0
      ? 0
      : Math.max(...round0.map((e) => (Number.isFinite(e.orderInRound) ? e.orderInRound : 0)));
  const nextOrder = maxOrder0 + 1;
  const ev: RosterChangeEventPort = {
    at: now,
    roundId: 0,
    orderInRound: nextOrder,
    winner: targetOwnerName,
    playerOutId,
    playerInId,
    effectiveAfterColumnId: effectiveAfterColumnId ?? null,
  };
  const rosterHistory = [...parsed.rosterHistory, ev];
  const newLog: WaiverLogEntryPort = logEntry(
    "ADMIN_COMMISSIONER_TRANSFER",
    `Commissioner transfer: ${targetOwnerName} acquired ${playerInId} for ₹0 (dropped ${playerOutId}).`,
    {
      transferId,
      targetOwner: targetOwnerName,
      playerInId,
      playerOutId,
      amount: 0,
      effectiveAfterColumnId: effectiveAfterColumnId ?? null,
    },
  );
  const log = [...parsed.log, newLog].slice(-500);

  const nextPayload: WaiverPersistentStatePort = {
    ...parsed,
    rosters,
    rosterHistory,
    log,
  };

  const batch = db.batch();
  batch.set(
    waiverRef,
    {
      payload: stripUndefined(nextPayload),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    db.collection("completedTransfers").doc(transferId),
    stripUndefined(completedTransfer),
  );
  await batch.commit();

  return { ok: true, transferId, appliedAt: now };
}
