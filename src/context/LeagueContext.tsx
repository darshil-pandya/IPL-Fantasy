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
import { loadLeagueBundle, summarizeBundle } from "../lib/loadLeague";

type LeagueCtx = {
  bundle: LeagueBundle | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  summary: ReturnType<typeof summarizeBundle> | null;
};

const LeagueContext = createContext<LeagueCtx | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<LeagueBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const b = await loadLeagueBundle();
      setBundle(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load league data");
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(
    () => (bundle ? summarizeBundle(bundle) : null),
    [bundle],
  );

  const value = useMemo(
    () => ({ bundle, error, loading, refresh, summary }),
    [bundle, error, loading, refresh, summary],
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
