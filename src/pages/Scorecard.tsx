import { useEffect, useState } from "react";
import { useLeague } from "../context/LeagueContext";

interface MatchSummary {
  match_id: string;
  name: string;
  date: string;
  status: string;
  teams: string[];
}

interface BattingRow {
  name: string;
  runs: string | number;
  balls: string | number;
  fours: string | number;
  sixes: string | number;
  sr: string | number;
  dismissal: string;
  fantasyPts?: number;
}

interface BowlingRow {
  name: string;
  overs: string;
  maidens: string | number;
  runs: string | number;
  wickets: string | number;
  economy: string | number;
  fantasyPts?: number;
}

interface ScorecardInnings {
  team: string;
  runs: string | number;
  wickets: string | number;
  overs: string | number;
  batting: BattingRow[];
  bowling: BowlingRow[];
}

const API_BASE = import.meta.env.BASE_URL;
const CRICAPI_KEY = import.meta.env.VITE_CRICAPI_KEY || "";

const TEAM_ABBREVS: Record<string, string> = {
  csk: "chennai", mi: "mumbai", rcb: "bangalore", kkr: "kolkata",
  dc: "delhi", srh: "hyderabad", pbks: "punjab", rr: "rajasthan",
  lsg: "lucknow", gt: "gujarat",
};

async function fetchRecentMatches(): Promise<MatchSummary[]> {
  if (!CRICAPI_KEY) return [];
  try {
    const r = await fetch(
      `https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`,
      { headers: { Accept: "application/json" } }
    );
    const data = await r.json();
    if (data.status !== "success") return [];
    return (data.data || [])
      .filter((m: Record<string,string>) => m.name?.includes("IPL") || m.series?.includes("Premier"))
      .map((m: Record<string,unknown>) => ({
        match_id: m.id as string,
        name: m.name as string,
        date: m.date as string,
        status: m.status as string,
        teams: (m.teams as {name:string}[] || []).map((t:{name:string}) => t.name),
      }));
  } catch {
    return [];
  }
}

async function fetchScorecard(matchId: string): Promise<ScorecardInnings[] | null> {
  if (!CRICAPI_KEY) return null;
  try {
    const r = await fetch(
      `https://api.cricapi.com/v1/match_scorecard?apikey=${CRICAPI_KEY}&id=${matchId}`,
      { headers: { Accept: "application/json" } }
    );
    const data = await r.json();
    if (data.status !== "success") return null;
    const sc = data.data;
    const innings: ScorecardInnings[] = (sc?.scorecard || sc?.innings || []).map(
      (inn: Record<string, unknown>) => ({
        team: (inn.inningsTeamName || inn.team || "Innings") as string,
        runs: (inn.r || inn.runs || "-") as string,
        wickets: (inn.w || inn.wickets || "-") as string,
        overs: (inn.o || inn.overs || "-") as string,
        batting: ((inn.batting || inn.inningsBatsmen || []) as Record<string,unknown>[]).map(
          (b) => ({
            name: ((b.batsman as {name:string})?.name || b.name || "") as string,
            runs: (b.r ?? "-") as string,
            balls: (b.b ?? "-") as string,
            fours: (b["4s"] ?? 0) as number,
            sixes: (b["6s"] ?? 0) as number,
            sr: (b.sr ?? "-") as string,
            dismissal: (b.dismissal || "not out") as string,
          })
        ),
        bowling: ((inn.bowling || inn.inningsBowlers || []) as Record<string,unknown>[]).map(
          (b) => ({
            name: ((b.bowler as {name:string})?.name || b.name || "") as string,
            overs: (b.o ?? "-") as string,
            maidens: (b.m ?? 0) as number,
            runs: (b.r ?? "-") as string,
            wickets: (b.w ?? 0) as number,
            economy: (b.eco ?? "-") as string,
          })
        ),
      })
    );
    return innings;
  } catch {
    return null;
  }
}

function searchMatches(query: string, matches: MatchSummary[]): MatchSummary[] {
  const q = query.toLowerCase();
  return matches.filter((m) => {
    if (m.name.toLowerCase().includes(q)) return true;
    for (const [abbr, full] of Object.entries(TEAM_ABBREVS)) {
      if (q.includes(abbr) && m.name.toLowerCase().includes(full)) return true;
    }
    return false;
  });
}

function ScorecardTable({ innings }: { innings: ScorecardInnings }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="text-base font-bold text-brand-dark">{innings.team}</h3>
        <span className="text-lg font-semibold text-brand-ocean">
          {innings.runs}/{innings.wickets}
        </span>
        <span className="text-sm text-slate-500">({innings.overs} ov)</span>
      </div>

      {/* Batting table */}
      {innings.batting.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cyan/30 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left font-medium">Batter</th>
                <th className="py-2 text-right font-medium">R</th>
                <th className="py-2 text-right font-medium">B</th>
                <th className="py-2 text-right font-medium">4s</th>
                <th className="py-2 text-right font-medium">6s</th>
                <th className="py-2 text-right font-medium">SR</th>
                <th className="py-2 pl-4 text-left font-medium">Dismissal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {innings.batting.map((b, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 font-medium text-brand-dark">{b.name}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-brand-ocean">{b.runs}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.balls}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.fours}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.sixes}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.sr}</td>
                  <td className="py-2 pl-4 text-xs text-slate-500">{b.dismissal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bowling table */}
      {innings.bowling.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-cyan/30 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 text-left font-medium">Bowler</th>
                <th className="py-2 text-right font-medium">O</th>
                <th className="py-2 text-right font-medium">M</th>
                <th className="py-2 text-right font-medium">R</th>
                <th className="py-2 text-right font-medium">W</th>
                <th className="py-2 text-right font-medium">Econ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {innings.bowling.map((b, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 font-medium text-brand-dark">{b.name}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.overs}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.maidens}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.runs}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-brand-ocean">{b.wickets}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{b.economy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Scorecard() {
  const { bundle } = useLeague();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchSummary | null>(null);
  const [innings, setInnings] = useState<ScorecardInnings[] | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const noKey = !CRICAPI_KEY;

  useEffect(() => {
    if (noKey) return;
    setLoading(true);
    fetchRecentMatches()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, [noKey]);

  const filtered = search
    ? searchMatches(search, matches)
    : matches;

  async function openMatch(m: MatchSummary) {
    setSelectedMatch(m);
    setInnings(null);
    setScorecardLoading(true);
    const sc = await fetchScorecard(m.match_id);
    setInnings(sc);
    setScorecardLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">🏏 Match Scorecards</h1>
        <p className="mt-1 text-sm text-slate-500">Last 48 hours · IPL 2026</p>
        {bundle?.meta?.lastPointsUpdate && (
          <p className="mt-1 text-xs text-slate-400">
            Points last updated: {bundle.meta.lastPointsUpdate}
          </p>
        )}
      </div>

      {noKey ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-800">API Key Required</p>
          <p className="mt-2 text-sm text-amber-700">
            Add{" "}
            <code className="rounded bg-amber-100 px-1">VITE_CRICAPI_KEY</code>{" "}
            to your{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> file
            and to GitHub Secrets. Get a free key at{" "}
            <a
              href="https://cricapi.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              cricapi.com
            </a>
            .
          </p>
          <p className="mt-2 text-xs text-amber-600">
            Free tier: 100,000 requests / hour
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by team (CSK, MI, RCB...) or match name"
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-brand-cyan focus:outline-none"
            />
          </div>

          {/* Match list */}
          {loading ? (
            <p className="text-sm text-slate-500">Loading recent matches…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-slate-500">
                {search ? `No matches found for "${search}"` : "No IPL matches in the last 48 hours."}
              </p>
            </div>
          ) : (
            <div className="mb-6 grid gap-2">
              {filtered.map((m) => (
                <button
                  key={m.match_id}
                  onClick={() => void openMatch(m)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all hover:border-brand-cyan hover:shadow-sm ${
                    selectedMatch?.match_id === m.match_id
                      ? "border-brand-cyan bg-brand-pale"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-brand-dark">{m.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{m.date}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{m.status}</p>
                </button>
              ))}
            </div>
          )}

          {/* Scorecard panel */}
          {selectedMatch && (
            <div className="rounded-xl border border-brand-cyan/40 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-brand-dark">
                    {selectedMatch.name}
                  </h2>
                  <p className="text-sm text-slate-500">{selectedMatch.status}</p>
                </div>
                <button
                  onClick={() => { setSelectedMatch(null); setInnings(null); }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:border-slate-400"
                >
                  ✕ Close
                </button>
              </div>

              {scorecardLoading ? (
                <p className="text-sm text-slate-500">Loading scorecard…</p>
              ) : innings === null ? (
                <p className="text-sm text-red-500">
                  Could not load scorecard. Match may not have started yet.
                </p>
              ) : innings.length === 0 ? (
                <p className="text-sm text-slate-500">No scorecard data available.</p>
              ) : (
                innings.map((inn, i) => (
                  <ScorecardTable key={i} innings={inn} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
