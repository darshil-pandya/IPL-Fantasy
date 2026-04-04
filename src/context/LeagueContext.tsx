import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FantasyMatchOverlayEntry, LeagueBundle } from "../types";
import { mergeBundleWithFantasyOverlays } from "../lib/fantasy/mergeOverlay";
import {
  isFirebaseConfigured,
  leagueDataSourceMode,
} from "../lib/firebase/client";
import { subscribeFantasyMatchOverlays } from "../lib/firebase/fantasyScoresRemote";
import {
  fetchLeagueBundleOnce,
  subscribeLeagueBundle,
} from "../lib/firebase/leagueRemote";
import { fetchLeagueBundleStatic, summarizeBundle } from "../lib/loadLeague";

type LeagueCtx = {
  bundle: LeagueBundle | null;
  error: string | null;
  loading: boolean;
  /** Shown when Firestore is empty but static JSON was used (auto mode). */
  leagueNotice: string | null;
  /** Firestore fantasy overlay listener issue (optional). */
  fantasyOverlayNotice: string | null;
  refresh: () => Promise<void>;
  summary: ReturnType<typeof summarizeBundle> | null;
};

const LeagueContext = createContext<LeagueCtx | null>(null);

const STATIC_FALLBACK_NOTICE =
  "Showing JSON from this site—Firestore league document is empty. Commissioner: Waivers → Publish league to Firestore.";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [rawBundle, setRawBundle] = useState<LeagueBundle | null>(null);
  const [fantasyOverlays, setFantasyOverlays] = useState<
    FantasyMatchOverlayEntry[]
  >([]);
  const [fantasyOverlayNotice, setFantasyOverlayNotice] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagueNotice, setLeagueNotice] = useState<string | null>(null);

  const bundle = useMemo(
    () =>
      rawBundle
        ? mergeBundleWithFantasyOverlays(rawBundle, fantasyOverlays)
        : null,
    [rawBundle, fantasyOverlays],
  );

  const refresh = useCallback(async () => {
    const mode = leagueDataSourceMode();
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured() || mode === "static") {
        const b = await fetchLeagueBundleStatic();
        setRawBundle(b);
        setLeagueNotice(null);
        return;
      }
      const b = await fetchLeagueBundleOnce();
      if (b) {
        setRawBundle(b);
        setLeagueNotice(null);
        return;
      }
      if (mode === "firestore") {
        setError(
          "No league data in Firestore (iplFantasy/leagueBundle). Use Commissioner → Publish league to Firestore.",
        );
        setRawBundle(null);
        return;
      }
      const sb = await fetchLeagueBundleStatic();
      setRawBundle(sb);
      setLeagueNotice(STATIC_FALLBACK_NOTICE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh league data");
      setRawBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const mode = leagueDataSourceMode();

    function loadStaticOnly() {
      setLoading(true);
      setError(null);
      void fetchLeagueBundleStatic()
        .then((b) => {
          if (cancelled) return;
          setRawBundle(b);
          setLeagueNotice(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(
            e instanceof Error ? e.message : "Failed to load league data",
          );
          setRawBundle(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    if (!isFirebaseConfigured() || mode === "static") {
      loadStaticOnly();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    void (async () => {
      const u = await subscribeLeagueBundle((b, err) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setRawBundle(null);
          setLoading(false);
          return;
        }
        if (b) {
          setRawBundle(b);
          setError(null);
          setLeagueNotice(null);
          setLoading(false);
          return;
        }
        if (mode === "firestore") {
          setError(
            "No league data in Firestore (iplFantasy/leagueBundle). Use Commissioner → Publish league to Firestore.",
          );
          setRawBundle(null);
          setLoading(false);
          return;
        }
        void fetchLeagueBundleStatic()
          .then((sb) => {
            if (cancelled) return;
            setRawBundle(sb);
            setError(null);
            setLeagueNotice(STATIC_FALLBACK_NOTICE);
            setLoading(false);
          })
          .catch((e) => {
            if (cancelled) return;
            setError(
              e instanceof Error ? e.message : "Failed to load static league",
            );
            setRawBundle(null);
            setLoading(false);
          });
      });
      if (cancelled) {
        u?.();
        return;
      }
      unsub = u ?? undefined;
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFantasyOverlays([]);
      setFantasyOverlayNotice(null);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void (async () => {
      const u = await subscribeFantasyMatchOverlays(
        (entries) => {
          if (cancelled) return;
          setFantasyOverlays(entries);
          setFantasyOverlayNotice(null);
        },
        (e) => {
          if (cancelled) return;
          setFantasyOverlayNotice(e.message);
        },
      );
      if (cancelled) {
        u?.();
        return;
      }
      unsub = u ?? undefined;
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const summary = useMemo(
    () => (bundle ? summarizeBundle(bundle) : null),
    [bundle],
  );

  const value = useMemo(
    () => ({
      bundle,
      error,
      loading,
      leagueNotice,
      fantasyOverlayNotice,
      refresh,
      summary,
    }),
    [
      bundle,
      error,
      loading,
      leagueNotice,
      fantasyOverlayNotice,
      refresh,
      summary,
    ],
  );

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  );
}

export function useLeague(): LeagueCtx {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error("useLeague must be used within LeagueProvider");
  return ctx;
}
