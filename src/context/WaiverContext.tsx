import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Franchise, LeagueBundle, Player } from "../types";
import { useLeague } from "./LeagueContext";
import {
  loadSession,
  saveSession,
  verifyLogin,
  type WaiverSession,
} from "../lib/waiver/auth";
import { WAIVER_LS_KEY } from "../lib/waiver/constants";
import {
  alignStateWithFranchises,
  franchisesFromRosters,
  reduceWaiver,
  type WaiverEngineAction,
} from "../lib/waiver/engine";
import { seedWaiverState } from "../lib/waiver/seed";
import type { RosterChangeEvent, WaiverPersistentState } from "../lib/waiver/types";
import { matchColumnsFromPlayers } from "../lib/matchColumns";
import { summarizeDisplayFranchises } from "../lib/waiver/summarize";
import { isPlayerAvailable } from "../lib/waiver/available";
import {
  isFirebaseWaiverConfigured,
  pushWaiverRemote,
  subscribeWaiverRemote,
  writeCompletedTransfers,
  loadCompletedTransfers,
} from "../lib/firebase/waiverRemote";
import { WAIVER_BUDGET_START } from "../lib/waiver/constants";
import {
  callWaiverNominate,
  callWaiverBid,
  callWaiverSettle,
  callSetWaiverPhase,
  callMigrateToCollections,
  type SettleResult,
  type MigrateResult,
} from "../lib/firebase/waiverApi";

function loadParsedState(): WaiverPersistentState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(WAIVER_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WaiverPersistentState;
  } catch {
    return null;
  }
}

function saveState(s: WaiverPersistentState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(WAIVER_LS_KEY, JSON.stringify(s));
}

function initWaiverState(bundle: LeagueBundle): WaiverPersistentState {
  return alignStateWithFranchises(
    loadParsedState() ?? seedWaiverState(bundle.franchises),
    bundle.franchises,
  );
}

type WaiverCtx = {
  session: WaiverSession | null;
  login: (label: string, password: string) => string | null;
  logout: () => void;
  state: WaiverPersistentState;
  displayFranchises: Franchise[];
  displaySummary: ReturnType<typeof summarizeDisplayFranchises> | null;
  /** @deprecated Use cloud methods below for server-validated mutations. */
  dispatch: (a: WaiverEngineAction) => string | null;
  availableIds: string[];
  remoteConnected: boolean;
  remoteError: string | null;
  /** Cloud Function backed mutations (server-validated, atomic writes). */
  cloud: {
    nominate: (params: {
      nominatedPlayerId: string;
      playerToDropId: string;
    }) => Promise<{ nominationId: string }>;
    bid: (params: {
      nominationId: string;
      bidAmount: number;
      playerToDropId?: string;
    }) => Promise<{ bidId: string }>;
    settle: (nominationId: string) => Promise<SettleResult>;
    setPhase: (
      phase: "idle" | "nomination" | "bidding",
    ) => Promise<{ phase: string; isWaiverWindowOpen: boolean }>;
    migrate: () => Promise<MigrateResult>;
  };
};

const WaiverContext = createContext<WaiverCtx | null>(null);

export function WaiverProvider({ children }: { children: ReactNode }) {
  const { bundle } = useLeague();
  if (!bundle) {
    throw new Error("WaiverProvider must render only when league data is loaded.");
  }
  const [session, setSession] = useState<WaiverSession | null>(() =>
    loadSession(),
  );
  const [state, setState] = useState<WaiverPersistentState>(() =>
    initWaiverState(bundle),
  );
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const skipNextPush = useRef(false);
  const localPushInFlight = useRef(false);
  const bundleKeyRef = useRef<string>("");
  const budgetRepairDone = useRef(false);

  const allPlayersForScoring = useMemo(() => {
    const list: Player[] = [];
    const seen = new Set<string>();
    for (const p of bundle.players) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    }
    for (const p of bundle.waiverPool ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    }
    return list;
  }, [bundle]);

  const revealEffectiveAfterColumnId = useMemo(() => {
    const cols = matchColumnsFromPlayers(allPlayersForScoring);
    return cols.length > 0 ? cols[cols.length - 1].id : null;
  }, [allPlayersForScoring]);

  useEffect(() => {
    const key = JSON.stringify(bundle.franchises);
    if (bundleKeyRef.current !== key) {
      bundleKeyRef.current = key;
      setState((prev) => alignStateWithFranchises(prev, bundle.franchises));
    }
  }, [bundle]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeWaiverRemote(
      (payload) => {
        if (payload == null) return;
        if (localPushInFlight.current) return;
        try {
          skipNextPush.current = true;
          setState(
            alignStateWithFranchises(
              payload as WaiverPersistentState,
              bundle.franchises,
            ),
          );
          setRemoteConnected(true);
        } catch {
          setRemoteError("Invalid remote waiver payload.");
        }
      },
      (e) => setRemoteError(e.message),
    ).then((u) => {
      if (cancelled) {
        u?.();
        return;
      }
      unsub = u ?? undefined;
      if (u) setRemoteConnected(true);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [bundle]);

  useEffect(() => {
    if (!state) return;
    saveState(state);
    if (!isFirebaseWaiverConfigured()) return;
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void pushWaiverRemote(state).catch((e: Error) =>
        setRemoteError(e.message),
      );
    }, 400);
    return () => window.clearTimeout(t);
  }, [state, bundle]);

  useEffect(() => {
    if (!remoteConnected || budgetRepairDone.current) return;
    budgetRepairDone.current = true;

    const cols = matchColumnsFromPlayers(allPlayersForScoring);

    void (async () => {
      try {
        const transfers = await loadCompletedTransfers();
        if (transfers.length === 0) return;

        const spent: Record<string, number> = {};
        for (const t of transfers) {
          const won = t.bids.find((b) => b.result === "WON");
          if (won) {
            spent[won.owner] = (spent[won.owner] ?? 0) + won.amount;
          }
        }

        setState((prev) => {
          let changed = false;

          // --- Budget repair ---
          const corrected = { ...prev.budgets };
          for (const [owner, amountSpent] of Object.entries(spent)) {
            const expected = WAIVER_BUDGET_START - amountSpent;
            if (corrected[owner] !== expected) {
              corrected[owner] = expected;
              changed = true;
            }
          }

          // --- RosterHistory repair ---
          const existingKeys = new Set(
            prev.rosterHistory.map(
              (e) => `${e.playerInId}|${e.winner}|${e.roundId}`,
            ),
          );
          const missing: RosterChangeEvent[] = [];
          const roundGroups = new Map<number, typeof transfers>();
          for (const t of transfers) {
            const g = roundGroups.get(t.roundId) ?? [];
            g.push(t);
            roundGroups.set(t.roundId, g);
          }
          for (const [roundId, group] of roundGroups) {
            group.sort((a, b) => a.revealedAt.localeCompare(b.revealedAt));
            group.forEach((t, idx) => {
              const won = t.bids.find((b) => b.result === "WON");
              if (!won) return;
              const key = `${t.playerInId}|${won.owner}|${roundId}`;
              if (existingKeys.has(key)) return;
              let effCol: string | null = null;
              for (const c of cols) {
                if (c.date <= t.revealedAt) effCol = c.id;
                else break;
              }
              missing.push({
                at: t.revealedAt,
                roundId,
                orderInRound: idx,
                winner: won.owner,
                playerOutId: won.playerOutId,
                playerInId: t.playerInId,
                effectiveAfterColumnId: effCol,
              });
            });
          }

          if (missing.length > 0) changed = true;

          if (!changed) return prev;
          return {
            ...prev,
            budgets: corrected,
            rosterHistory: missing.length > 0
              ? [...prev.rosterHistory, ...missing]
              : prev.rosterHistory,
          };
        });
      } catch {
        // Non-critical — repairs will run on next load
      }
    })();
  }, [remoteConnected, allPlayersForScoring]);

  const displayFranchises = useMemo(() => {
    if (!bundle || !state) return [];
    return franchisesFromRosters(bundle.franchises, state.rosters);
  }, [bundle, state]);

  const displaySummary = useMemo(() => {
    if (!bundle || !state) return null;
    return summarizeDisplayFranchises(
      bundle,
      displayFranchises,
      state.pointCarryover,
      state.rosterHistory,
      state.rosters,
    );
  }, [bundle, state, displayFranchises]);

  const availableIds = useMemo(() => {
    if (!bundle || !state) return [];
    const seen = new Set<string>();
    const list: Player[] = [];
    for (const p of bundle.players) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    }
    for (const p of bundle.waiverPool ?? []) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    }
    return list
      .filter((p) => isPlayerAvailable(state.rosters, p.id))
      .map((p) => p.id);
  }, [bundle, state]);

  const dispatch = useCallback(
    (action: WaiverEngineAction): string | null => {
      if (!bundle || !state) return "Loading…";
      const result = reduceWaiver(state, action, {
        baseFranchises: bundle.franchises,
        revealEffectiveAfterColumnId,
      });
      if (result.error) return result.error;
      setState(result.state);
      // Push to Firestore immediately to prevent the subscription from
      // overwriting with stale data before the debounced push fires.
      skipNextPush.current = true;
      localPushInFlight.current = true;
      void pushWaiverRemote(result.state)
        .catch((e: Error) => setRemoteError(e.message))
        .finally(() => { localPushInFlight.current = false; });
      if (result.completedTransfers?.length) {
        void writeCompletedTransfers(result.completedTransfers).catch(
          (e: Error) => setRemoteError(e.message),
        );
      }
      return null;
    },
    [bundle, state, revealEffectiveAfterColumnId],
  );

  const login = useCallback((label: string, password: string) => {
    const s = verifyLogin(label, password);
    if (!s) return "Invalid user or password.";
    setSession(s);
    saveSession(s);
    return null;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    saveSession(null);
  }, []);

  const cloud = useMemo(() => {
    const ownerName = session?.role === "owner" ? session.owner : "";
    const ownerPassword = "";

    return {
      nominate: async (params: {
        nominatedPlayerId: string;
        playerToDropId: string;
      }) => {
        return callWaiverNominate({
          ownerName,
          ownerPassword,
          ...params,
        });
      },
      bid: async (params: {
        nominationId: string;
        bidAmount: number;
        playerToDropId?: string;
      }) => {
        return callWaiverBid({
          ownerName,
          ownerPassword,
          ...params,
        });
      },
      settle: async (nominationId: string) => {
        return callWaiverSettle({ nominationId });
      },
      setPhase: async (phase: "idle" | "nomination" | "bidding") => {
        return callSetWaiverPhase({ targetPhase: phase });
      },
      migrate: async () => {
        return callMigrateToCollections();
      },
    };
  }, [session]);

  return (
    <WaiverContext.Provider
      value={{
        session,
        login,
        logout,
        state,
        displayFranchises,
        displaySummary,
        dispatch,
        availableIds,
        remoteConnected,
        remoteError,
        cloud,
      }}
    >
      {children}
    </WaiverContext.Provider>
  );
}

export function useWaiver(): WaiverCtx {
  const ctx = useContext(WaiverContext);
  if (!ctx) throw new Error("useWaiver must be used within WaiverProvider");
  return ctx;
}

export function useLeagueStandings() {
  const { bundle, loading, error } = useLeague();
  const w = useWaiver();
  return useMemo(() => {
    if (loading || error || !bundle) return null;
    return w.displaySummary;
  }, [bundle, loading, error, w.displaySummary]);
}
