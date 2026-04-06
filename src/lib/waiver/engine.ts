import type { Franchise } from "../../types";
import type { RosterChangeEvent, CompletedTransfer, CompletedBid } from "./types";
import type {
  WaiverBid,
  WaiverLogEntry,
  WaiverNomination,
  WaiverPersistentState,
  WaiverPhase,
} from "./types";
import { WAIVER_BID_INCREMENT, WAIVER_BUDGET_START } from "./constants";
import { isPlayerAvailable } from "./available";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  const u =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  return `${prefix}-${u}`;
}

function logEntry(
  kind: string,
  message: string,
  meta?: Record<string, unknown>,
): WaiverLogEntry {
  const at = nowIso();
  if (meta == null) return { at, kind, message };
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return { at, kind, message };
  return { at, kind, message, meta: cleaned };
}

function validBidAmount(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n % WAIVER_BID_INCREMENT === 0;
}

function pushLog(
  state: WaiverPersistentState,
  entry: WaiverLogEntry,
): WaiverPersistentState {
  return { ...state, log: [...state.log, entry].slice(-500) };
}

export function franchisesFromRosters(
  base: Franchise[],
  rosters: Record<string, string[]>,
): Franchise[] {
  return base.map((f) => ({
    ...f,
    playerIds: rosters[f.owner] ? [...rosters[f.owner]] : [...f.playerIds],
  }));
}

type Ctx = {
  baseFranchises: Franchise[];
  /**
   * Last completed match column id when this reveal runs; swaps apply from the next match onward.
   * `null` if no matches exist yet (swap applies from the first match).
   */
  revealEffectiveAfterColumnId: string | null;
};

export type WaiverEngineAction =
  | { type: "admin_start_nomination" }
  | { type: "admin_start_bidding" }
  | {
      type: "admin_reveal";
    }
  | {
      type: "nomination_upsert";
      owner: string;
      nominationId: string | null;
      playerInId: string;
      playerOutId: string;
      amount: number;
    }
  | { type: "nomination_delete"; owner: string; nominationId: string }
  | {
      type: "bid_upsert";
      bidderOwner: string;
      nominationId: string;
      playerOutId: string;
      amount: number;
    };

export type WaiverReduceResult = {
  state: WaiverPersistentState;
  error?: string;
  completedTransfers?: CompletedTransfer[];
};

export function reduceWaiver(
  state: WaiverPersistentState,
  action: WaiverEngineAction,
  ctx: Ctx,
): WaiverReduceResult {
  const owners = ctx.baseFranchises.map((f) => f.owner);

  const ensureOwner = (o: string) => {
    if (!owners.includes(o)) return "Unknown franchise owner.";
    return null;
  };

  const roster = (o: string) => state.rosters[o] ?? [];

  switch (action.type) {
    case "admin_start_nomination": {
      if (state.phase !== "idle") {
        return { state, error: "Start nomination only from idle (reveal the prior round first)." };
      }
      const next: WaiverPersistentState = {
        ...state,
        roundId: state.roundId + 1,
        phase: "nomination",
        nominations: [],
        bids: [],
      };
      return {
        state: pushLog(
          next,
          logEntry("phase", `Nomination phase started (round ${next.roundId}).`),
        ),
      };
    }

    case "admin_start_bidding": {
      if (state.phase !== "nomination") {
        return { state, error: "Start bidding only during nomination phase." };
      }
      const next = { ...state, phase: "bidding" as WaiverPhase };
      return {
        state: pushLog(next, logEntry("phase", "Bidding phase started.")),
      };
    }

    case "admin_reveal": {
      if (state.phase !== "bidding") {
        return { state, error: "Reveal only after bidding phase." };
      }
      return resolveRound(state, ctx);
    }

    case "nomination_delete": {
      if (state.phase !== "nomination") {
        return { state, error: "Nominations are locked." };
      }
      const nom = state.nominations.find((n) => n.id === action.nominationId);
      if (!nom || nom.nominatorOwner !== action.owner) {
        return { state, error: "Nomination not found." };
      }
      const next = {
        ...state,
        nominations: state.nominations.filter((n) => n.id !== action.nominationId),
      };
      return {
        state: pushLog(
          next,
          logEntry("nomination", `Nomination withdrawn for ${nom.playerInId}.`, {
            owner: action.owner,
          }),
        ),
      };
    }

    case "nomination_upsert": {
      if (state.phase !== "nomination") {
        return { state, error: "Nomination window is closed." };
      }
      const e = ensureOwner(action.owner);
      if (e) return { state, error: e };
      if (!validBidAmount(action.amount)) {
        return {
          state,
          error: `Bid must be a positive multiple of ${WAIVER_BID_INCREMENT}.`,
        };
      }
      const r = roster(action.owner);
      if (!r.includes(action.playerOutId)) {
        return { state, error: "Out player must be on your roster." };
      }
      if (r.includes(action.playerInId)) {
        return { state, error: "Nominee is already on your roster." };
      }
      if (!isPlayerAvailable(state.rosters, action.playerInId)) {
        return { state, error: "Nominee is not available (on a roster already)." };
      }
      const nominatedIns = new Set(
        state.nominations
          .filter((n) => n.id !== action.nominationId)
          .map((n) => n.playerInId),
      );
      if (action.nominationId) {
        const existing = state.nominations.find((n) => n.id === action.nominationId);
        if (!existing || existing.nominatorOwner !== action.owner) {
          return { state, error: "Cannot edit this nomination." };
        }
      }
      if (nominatedIns.has(action.playerInId)) {
        return { state, error: "That player is already nominated this round." };
      }
      const myOuts = new Set<string>();
      for (const n of state.nominations) {
        if (n.nominatorOwner !== action.owner) continue;
        if (n.id === action.nominationId) continue;
        myOuts.add(n.playerOutId);
      }
      if (myOuts.has(action.playerOutId)) {
        return {
          state,
          error: "You cannot use the same out player on two nominations.",
        };
      }

      const t = nowIso();
      let nominations: WaiverNomination[];
      if (action.nominationId) {
        nominations = state.nominations.map((n) =>
          n.id === action.nominationId
            ? {
                ...n,
                playerInId: action.playerInId,
                playerOutId: action.playerOutId,
                amount: action.amount,
                updatedAt: t,
              }
            : n,
        );
      } else {
        const row: WaiverNomination = {
          id: newId("nom"),
          roundId: state.roundId,
          nominatorOwner: action.owner,
          playerInId: action.playerInId,
          playerOutId: action.playerOutId,
          amount: action.amount,
          createdAt: t,
          updatedAt: t,
        };
        nominations = [...state.nominations, row];
      }
      const next = { ...state, nominations };
      return {
        state: pushLog(
          next,
          logEntry("nomination", `Nomination saved for ${action.playerInId}.`, {
            owner: action.owner,
          }),
        ),
      };
    }

    case "bid_upsert": {
      if (state.phase !== "bidding") {
        return { state, error: "Bidding is not open." };
      }
      const e = ensureOwner(action.bidderOwner);
      if (e) return { state, error: e };
      if (!validBidAmount(action.amount)) {
        return {
          state,
          error: `Bid must be a positive multiple of ${WAIVER_BID_INCREMENT}.`,
        };
      }
      const nom = state.nominations.find((n) => n.id === action.nominationId);
      if (!nom || nom.roundId !== state.roundId) {
        return { state, error: "Invalid nomination." };
      }
      if (nom.nominatorOwner === action.bidderOwner) {
        return {
          state,
          error:
            "You already have your opening bid on this nomination; edit it only during the nomination phase.",
        };
      }
      const r = roster(action.bidderOwner);
      if (!r.includes(action.playerOutId)) {
        return { state, error: "Out player must be on your roster." };
      }
      if (r.includes(nom.playerInId)) {
        return { state, error: "You already have this player." };
      }

      const t = nowIso();
      const existing = state.bids.find(
        (b) =>
          b.nominationId === action.nominationId &&
          b.bidderOwner === action.bidderOwner,
      );
      let bids: WaiverBid[];
      if (existing) {
        bids = state.bids.map((b) =>
          b.id === existing.id
            ? {
                ...b,
                playerOutId: action.playerOutId,
                amount: action.amount,
                updatedAt: t,
              }
            : b,
        );
      } else {
        bids = [
          ...state.bids,
          {
            id: newId("bid"),
            nominationId: action.nominationId,
            bidderOwner: action.bidderOwner,
            playerOutId: action.playerOutId,
            amount: action.amount,
            createdAt: t,
            updatedAt: t,
          },
        ];
      }
      const next = { ...state, bids };
      return {
        state: pushLog(
          next,
          logEntry("bid", `Bid placed on ${nom.playerInId}.`, {
            owner: action.bidderOwner,
            amount: action.amount,
          }),
        ),
      };
    }

    default:
      return { state, error: "Unknown action." };
  }
}

type Candidate = {
  owner: string;
  playerOutId: string;
  amount: number;
  ts: number;
};

function resolveRound(
  state: WaiverPersistentState,
  ctx: Ctx,
): WaiverReduceResult {
  let rosters = { ...state.rosters };
  const budgets = { ...state.budgets };
  let log = state.log;
  const rosterHistory = [...state.rosterHistory];
  const completedTransfers: CompletedTransfer[] = [];
  let orderInRound = 0;

  const push = (entry: WaiverLogEntry) => {
    log = [...log, entry].slice(-500);
  };

  for (const nom of state.nominations) {
    const bidsOn = state.bids.filter((b) => b.nominationId === nom.id);
    const candidates: Candidate[] = [
      {
        owner: nom.nominatorOwner,
        playerOutId: nom.playerOutId,
        amount: nom.amount,
        ts: Date.parse(nom.createdAt),
      },
      ...bidsOn.map((b) => ({
        owner: b.bidderOwner,
        playerOutId: b.playerOutId,
        amount: b.amount,
        ts: Date.parse(b.createdAt),
      })),
    ];

    const affordable = candidates.filter((c) => budgets[c.owner] >= c.amount);
    affordable.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.ts - b.ts;
    });

    const winner = affordable[0];
    const pidIn = nom.playerInId;

    if (!winner) {
      push(
        logEntry("reveal", `No valid winner for nomination ${pidIn} (budget).`, {
          nominationId: nom.id,
        }),
      );
      continue;
    }

    const rWin = [...(rosters[winner.owner] ?? [])];
    if (!rWin.includes(winner.playerOutId) || rWin.includes(pidIn)) {
      push(
        logEntry(
          "reveal",
          `Skipped ${pidIn}: roster changed for ${winner.owner}.`,
          { nominationId: nom.id },
        ),
      );
      continue;
    }

    const nextR = rWin.filter((id) => id !== winner.playerOutId);
    nextR.push(pidIn);
    rosters[winner.owner] = nextR;

    budgets[winner.owner] = budgets[winner.owner] - winner.amount;

    const tReveal = nowIso();
    rosterHistory.push({
      at: tReveal,
      roundId: state.roundId,
      orderInRound: orderInRound++,
      winner: winner.owner,
      playerOutId: winner.playerOutId,
      playerInId: pidIn,
      effectiveAfterColumnId: ctx.revealEffectiveAfterColumnId,
    });

    // Build completed transfer record with all bids
    const allBids: CompletedBid[] = [
      {
        owner: nom.nominatorOwner,
        amount: nom.amount,
        playerOutId: nom.playerOutId,
        placedAt: nom.createdAt,
        result: winner.owner === nom.nominatorOwner ? "WON" : "LOST",
      },
      ...bidsOn.map((b): CompletedBid => ({
        owner: b.bidderOwner,
        amount: b.amount,
        playerOutId: b.playerOutId,
        placedAt: b.createdAt,
        result: winner.owner === b.bidderOwner ? "WON" : "LOST",
      })),
    ];
    completedTransfers.push({
      id: nom.id,
      roundId: state.roundId,
      revealedAt: tReveal,
      playerInId: pidIn,
      nominatorOwner: nom.nominatorOwner,
      bids: allBids,
      effectiveAfterColumnId: ctx.revealEffectiveAfterColumnId,
    });

    push(
      logEntry(
        "reveal",
        `${winner.owner} wins ${pidIn} for ${winner.amount} (drops ${winner.playerOutId}).`,
        {
          nominationId: nom.id,
          winner: winner.owner,
          amount: winner.amount,
          playerInId: pidIn,
          playerOutId: winner.playerOutId,
          effectiveAfterColumnId: ctx.revealEffectiveAfterColumnId,
        },
      ),
    );
  }

  const next: WaiverPersistentState = {
    ...state,
    phase: "idle",
    rosters,
    budgets,
    rosterHistory,
    nominations: [],
    bids: [],
    log,
  };

  return {
    state: pushLog(next, logEntry("phase", "Waiver round revealed; rosters updated.")),
    completedTransfers,
  };
}

/** Ensure every owner from JSON exists on persisted state (migration). */
export function alignStateWithFranchises(
  state: WaiverPersistentState,
  franchises: Franchise[],
): WaiverPersistentState {
  const raw = state as WaiverPersistentState & { rosterHistory?: RosterChangeEvent[] };
  const migrated: WaiverPersistentState =
    raw.version === 2 && Array.isArray(raw.rosterHistory)
      ? raw
      : {
          ...raw,
          version: 2,
          rosterHistory: raw.rosterHistory ?? [],
        };

  const rosters = { ...migrated.rosters };
  const budgets = { ...migrated.budgets };
  const pointCarryover = { ...migrated.pointCarryover };
  const joinSnapshot = { ...migrated.joinSnapshot };
  const rosterHistory = [...migrated.rosterHistory];
  for (const f of franchises) {
    if (!rosters[f.owner]) rosters[f.owner] = [...f.playerIds];
    if (budgets[f.owner] == null) budgets[f.owner] = WAIVER_BUDGET_START;
    if (pointCarryover[f.owner] == null) pointCarryover[f.owner] = 0;
  }
  return {
    ...migrated,
    rosters,
    budgets,
    pointCarryover,
    joinSnapshot,
    rosterHistory,
  };
}
