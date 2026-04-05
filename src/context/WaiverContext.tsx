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
import type { WaiverPersistentState } from "../lib/waiver/types";
import { matchColumnsFromPlayers } from "../lib/matchColumns";
import { summarizeDisplayFranchises } from "../lib/waiver/summarize";
import { isPlayerAvailable } from "../lib/waiver/available";
import {
  isFirebaseWaiverConfigured,
  pushWaiverRemote,
  subscribeWaiverRemote,
} from "../lib/firebase/waiverRemote";
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
  const bundleKeyRef = useRef<string>("");

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
      const { state: next, error } = reduceWaiver(state, action, {
        baseFranchises: bundle.franchises,
        revealEffectiveAfterColumnId,
      });
      if (error) return error;
      setState(next);
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
