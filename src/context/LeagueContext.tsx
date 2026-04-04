import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LeagueBundle } from "../types";
import {
  isFirebaseConfigured,
  leagueDataSourceMode,
} from "../lib/firebase/client";
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
  refresh: () => Promise<void>;
  summary: ReturnType<typeof summarizeBundle> | null;
};

const LeagueContext = createContext<LeagueCtx | null>(null);

const STATIC_FALLBACK_NOTICE =
  "Showing JSON from this site—Firestore league document is empty. Commissioner: Waivers → Publish league to Firestore.";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<LeagueBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagueNotice, setLeagueNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const mode = leagueDataSourceMode();
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured() || mode === "static") {
        const b = await fetchLeagueBundleStatic();
        setBundle(b);
        setLeagueNotice(null);
        return;
      }
      const b = await fetchLeagueBundleOnce();
      if (b) {
        setBundle(b);
        setLeagueNotice(null);
        return;
      }
      if (mode === "firestore") {
        setError(
          "No league data in Firestore (iplFantasy/leagueBundle). Use Commissioner → Publish league to Firestore.",
        );
        setBundle(null);
        return;
      }
      const sb = await fetchLeagueBundleStatic();
      setBundle(sb);
      setLeagueNotice(STATIC_FALLBACK_NOTICE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh league data");
      setBundle(null);
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
          setBundle(b);
          setLeagueNotice(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(
            e instanceof Error ? e.message : "Failed to load league data",
          );
          setBundle(null);
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
          setBundle(null);
          setLoading(false);
          return;
        }
        if (b) {
          setBundle(b);
          setError(null);
          setLeagueNotice(null);
          setLoading(false);
          return;
        }
        if (mode === "firestore") {
          setError(
            "No league data in Firestore (iplFantasy/leagueBundle). Use Commissioner → Publish league to Firestore.",
          );
          setBundle(null);
          setLoading(false);
          return;
        }
        void fetchLeagueBundleStatic()
          .then((sb) => {
            if (cancelled) return;
            setBundle(sb);
            setError(null);
            setLeagueNotice(STATIC_FALLBACK_NOTICE);
            setLoading(false);
          })
          .catch((e) => {
            if (cancelled) return;
            setError(
              e instanceof Error ? e.message : "Failed to load static league",
            );
            setBundle(null);
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
      refresh,
      summary,
    }),
    [bundle, error, loading, leagueNotice, refresh, summary],
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
