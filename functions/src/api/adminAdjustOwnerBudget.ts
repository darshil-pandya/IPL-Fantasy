import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { OwnerDoc } from "../models/types.js";
import { nowIso } from "../waiver/applyWaiverSwap.js";
import type {
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

export interface AdminAdjustOwnerBudgetInput {
  adminSecret: string;
  targetOwnerName: string;
  /** Positive to add, negative to subtract. Applied delta may be less if clamped. */
  delta: number;
}

export interface AdminAdjustOwnerBudgetResult {
  ok: true;
  newRemainingBudget: number;
  appliedDelta: number;
  requestedDelta: number;
  /** When true, `owners` and waiver were unchanged. */
  noOp?: boolean;
}

/**
 * Add or subtract an owner's remaining budget, clamping at 0. Keeps
 * `owners`, `waiverState.budgets`, and `budgetAdminAdjustments` in sync.
 */
export async function handleAdminAdjustOwnerBudget(
  data: AdminAdjustOwnerBudgetInput,
  expectedSecret: string,
): Promise<AdminAdjustOwnerBudgetResult> {
  if (data.adminSecret !== expectedSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }

  const targetOwnerName =
    typeof data.targetOwnerName === "string" ? data.targetOwnerName.trim() : "";
  const delta = data.delta;
  if (!targetOwnerName) {
    throw new HttpsError("invalid-argument", "targetOwnerName is required.");
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new HttpsError(
      "invalid-argument",
      "delta must be a non-zero finite number (positive to add, negative to subtract).",
    );
  }

  const db = getFirestore();
  const ownerRef = db.collection("owners").doc(targetOwnerName);
  const ownerSnap = await ownerRef.get();
  if (!ownerSnap.exists) {
    throw new HttpsError("not-found", `Owner "${targetOwnerName}" not found.`);
  }
  const owner = ownerSnap.data() as OwnerDoc;
  const current =
    typeof owner.remainingBudget === "number" && Number.isFinite(owner.remainingBudget)
      ? owner.remainingBudget
      : 0;
  const nextBudget = Math.max(0, current + delta);
  const appliedDelta = nextBudget - current;
  const requestedDelta = delta;

  if (appliedDelta === 0) {
    return {
      ok: true,
      newRemainingBudget: current,
      appliedDelta: 0,
      requestedDelta,
      noOp: true,
    };
  }

  const waiverRef = db.doc(WAIVER_STATE_DOC);
  const wsSnap = await waiverRef.get();
  if (!wsSnap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Waiver state document is missing. Cannot update embedded budgets.",
    );
  }
  const rawPayload = parseWaiverPayload(wsSnap.data());
  const parsed = asWaiverState(rawPayload);
  if (!parsed) {
    throw new HttpsError(
      "failed-precondition",
      "Waiver payload is invalid or not version 2; cannot adjust budget.",
    );
  }

  const budgets: Record<string, number> = { ...parsed.budgets };
  const prevWaiverB =
    typeof budgets[targetOwnerName] === "number" && Number.isFinite(budgets[targetOwnerName])
      ? (budgets[targetOwnerName] as number)
      : current;
  /** Align waiver budget with `owners` after this operation. */
  budgets[targetOwnerName] = nextBudget;

  const adjust = { ...(parsed.budgetAdminAdjustments ?? {}) };
  adjust[targetOwnerName] = (adjust[targetOwnerName] ?? 0) + appliedDelta;

  const newLog: WaiverLogEntryPort = logEntry(
    "ADMIN_BUDGET_ADJUST",
    `Admin budget: ${targetOwnerName} ${
      appliedDelta >= 0 ? "+" : ""
    }${appliedDelta} → remaining ₹${nextBudget.toFixed(0)}.`,
    {
      targetOwner: targetOwnerName,
      requestedDelta,
      appliedDelta,
      newRemainingBudget: nextBudget,
      previousRemainingBudget: current,
      previousWaiverBudget: prevWaiverB,
    },
  );
  const log = [...parsed.log, newLog].slice(-500);

  const nextPayload: WaiverPersistentStatePort = {
    ...parsed,
    budgets,
    budgetAdminAdjustments: adjust,
    log,
  };

  const batch = db.batch();
  batch.update(ownerRef, { remainingBudget: nextBudget });
  batch.set(
    waiverRef,
    {
      payload: stripUndefined(nextPayload),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();

  return {
    ok: true,
    newRemainingBudget: nextBudget,
    appliedDelta,
    requestedDelta,
  };
}
