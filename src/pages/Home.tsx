import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { OwnerBadge } from "../components/OwnerBadge";
import { OwnerPointsLineChart } from "../components/OwnerPointsLineChart";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import { buildOwnerCumulativeFromPerMatch } from "../lib/cumulativeOwnerMatchPoints";
import {
  leaderBestBattingAvg,
  leaderBestBowlingAvg,
  leaderMostCatches,
  leaderMostFantasyPoints,
  leaderMostFours,
  leaderMostSixes,
  leaderTopRuns,
  leaderTopWickets,
  playersForSeasonHighlights,
  countryLabel,
  roleLabel,
  type StatLeader,
} from "../lib/iplStatLeaders";
import { PREDICTION_ACTUALS_EVENT } from "../lib/predictionEvents";
import {
  loadStoredActuals,
  mergeActuals,
  pickForOwner,
  predictionScore,
} from "../lib/predictions";
import type { Player } from "../types";

function bestFantasyPlayerOnSquad(players: Player[]): Player | null {
  if (players.length === 0) return null;
  return [...players].sort(
    (a, b) => b.seasonTotal - a.seasonTotal || a.name.localeCompare(b.name),
  )[0];
}

function buildPlayerOwnerMap(
  standings: { owner: string; playersResolved: Player[] }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of standings) {
    for (const p of s.playersResolved) {
      m.set(p.id, s.owner);
    }
  }
  return m;
}

function HighlightStatCard({
  title,
  leader,
  ownerName,
}: {
  title: string;
  leader: StatLeader;
  ownerName: string;
}) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4 shadow-md shadow-black/20 ring-1 ring-cyan-500/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">{title}</p>
      {leader ? (
        <>
          <p className="mt-2 font-bold text-white">{leader.player.name}</p>
          <p className="mt-1 text-sm tabular-nums text-cyan-300">
            {leader.display} pts
          </p>
          {leader.secondaryStat ? (
            <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
              {leader.secondaryStat}
            </p>
          ) : null}
          {leader.caption ? (
            <p className="mt-1 text-[10px] leading-snug text-slate-500">{leader.caption}</p>
          ) : null}
          <dl className="mt-3 space-y-1 border-t border-cyan-500/15 pt-3 text-xs">
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Owner</dt>
              <dd className="font-medium text-slate-200">{ownerName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">IPL</dt>
              <dd className="text-slate-200">{leader.player.iplTeam}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Role</dt>
              <dd className="text-slate-200">{roleLabel(leader.player.role)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-slate-500">Country</dt>
              <dd className="text-slate-200">{countryLabel(leader.player.nationality)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No data yet</p>
      )}
    </div>
  );
}

export function Home() {
  const { bundle, leagueNotice, fantasyOverlayNotice } = useLeague();
  const summary = useLeagueStandings();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(PREDICTION_ACTUALS_EVENT, on);
    return () => window.removeEventListener(PREDICTION_ACTUALS_EVENT, on);
  }, []);

  const leaderboardRows = useMemo(() => {
    if (!bundle || !summary) return [];
    const pred = bundle.predictions;
    const actuals = mergeActuals(pred.actuals, loadStoredActuals());
    return summary.sorted.map((s) => {
      const pick = pickForOwner(pred, s.owner);
      const predPts = predictionScore(pick, actuals, pred.pointsPerCorrect);
      const fantasy = s.totalPoints;
      const best = bestFantasyPlayerOnSquad(s.playersResolved);
      return {
        owner: s.owner,
        fantasy,
        predPts,
        total: fantasy + predPts,
        bestPlayer: best,
      };
    });
  }, [bundle, summary, tick]);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardRows]
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [leaderboardRows]);

  const ownerPointsChart = useMemo(() => {
    if (!summary) return null;
    const order = sortedLeaderboard.map((r) => r.owner);
    return buildOwnerCumulativeFromPerMatch(
      summary.perOwnerPerMatch,
      summary.columns,
      order,
      summary.standings.map((s) => s.owner),
    );
  }, [summary, sortedLeaderboard]);

  const playerOwnerMap = useMemo(() => {
    if (!summary) return new Map<string, string>();
    return buildPlayerOwnerMap(summary.standings);
  }, [summary]);

  const statLeaders = useMemo(() => {
    if (!bundle) return null;
    const players = playersForSeasonHighlights(bundle);
    return {
      fantasy: leaderMostFantasyPoints(players),
      runs: leaderTopRuns(players),
      wickets: leaderTopWickets(players),
      batAvg: leaderBestBattingAvg(players),
      bowlAvg: leaderBestBowlingAvg(players),
      sixes: leaderMostSixes(players),
      fours: leaderMostFours(players),
      catches: leaderMostCatches(players),
    };
  }, [bundle]);

  if (!bundle || !summary || !statLeaders) return null;

  const pred = bundle.predictions;

  function ownerForLeader(leader: StatLeader): string {
    if (!leader) return "—";
    return playerOwnerMap.get(leader.player.id) ?? "Free agent";
  }

  return (
    <div className="space-y-8">
      {leagueNotice ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
          {leagueNotice}
        </div>
      ) : null}
      {fantasyOverlayNotice ? (
        <div className="rounded-xl border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          Firestore fantasy scores: {fantasyOverlayNotice}
        </div>
      ) : null}
      <section>
        <h2 className="font-display mb-2 text-2xl tracking-wide text-white">Leaderboard</h2>
        <p className="mb-3 text-sm text-slate-400">
          Sorted by rank (fantasy points plus prediction bonus: {pred.pointsPerCorrect}{" "}
          pts per correct when results are set). Fantasy uses match-by-match points only
          while each player was on that franchise (same as Match Center).
        </p>
        <div className="app-table">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-3 py-3 font-medium">Rank</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Best player</th>
                <th className="px-3 py-3 text-right font-medium text-amber-400">
                  Total pts
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.map((r) => (
                <tr key={r.owner} className="app-table-row">
                  <td className="px-3 py-3 font-semibold tabular-nums text-slate-500">
                    {r.rank}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/teams?owner=${encodeURIComponent(r.owner)}`}
                      className="font-semibold text-white hover:text-cyan-300"
                    >
                      {r.owner}
                    </Link>
                    <div className="mt-1">
                      <OwnerBadge owner={r.owner} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {r.bestPlayer ? (
                      <>
                        <span className="font-medium text-slate-100">
                          {r.bestPlayer.name}
                        </span>
                        <span className="ml-2 tabular-nums text-slate-500">
                          ({Math.round(r.bestPlayer.seasonTotal)} pts)
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-amber-400">
                    {Math.round(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display mb-2 text-2xl tracking-wide text-white">Season highlights</h2>
        <p className="mb-3 text-sm text-slate-400">
          Leaders are picked from IPL counting stats in optional{" "}
          <code className="app-code-inline">seasonStats</code> (full player pool + waiver pool).
          Points shown use <code className="app-code-inline">seasonFantasyPoints</code> where
          available, or a rough estimate from stats. Owner is the current fantasy franchise from
          waiver rosters; players not on a squad show as{" "}
          <span className="text-slate-300">Free agent</span>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HighlightStatCard
            title="Most fantasy points"
            leader={statLeaders.fantasy}
            ownerName={ownerForLeader(statLeaders.fantasy)}
          />
          <HighlightStatCard
            title="Top run scorer"
            leader={statLeaders.runs}
            ownerName={ownerForLeader(statLeaders.runs)}
          />
          <HighlightStatCard
            title="Top wicket taker"
            leader={statLeaders.wickets}
            ownerName={ownerForLeader(statLeaders.wickets)}
          />
          <HighlightStatCard
            title="Best batting average"
            leader={statLeaders.batAvg}
            ownerName={ownerForLeader(statLeaders.batAvg)}
          />
          <HighlightStatCard
            title="Best bowling average"
            leader={statLeaders.bowlAvg}
            ownerName={ownerForLeader(statLeaders.bowlAvg)}
          />
          <HighlightStatCard
            title="Most sixes"
            leader={statLeaders.sixes}
            ownerName={ownerForLeader(statLeaders.sixes)}
          />
          <HighlightStatCard
            title="Most fours"
            leader={statLeaders.fours}
            ownerName={ownerForLeader(statLeaders.fours)}
          />
          <HighlightStatCard
            title="Most catches"
            leader={statLeaders.catches}
            ownerName={ownerForLeader(statLeaders.catches)}
          />
        </div>
      </section>

      <section aria-label="Owner fantasy points by match">
        <h2 className="font-display mb-2 text-2xl tracking-wide text-white">
          Points through the season
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Cumulative points from the same per-match totals as the leaderboard (only
          matches while each player was on that franchise). Prediction bonus is not
          included.
        </p>
        {summary.mode === "legacy" ? (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
            Scoring is in legacy mode (waiver history does not replay to the current
            roster). Reveal a waiver round or reset waiver state so totals match roster
            timelines.
          </p>
        ) : null}
        {ownerPointsChart && ownerPointsChart.data.length > 1 ? (
          <div className="app-card overflow-hidden p-4 sm:p-5">
            <OwnerPointsLineChart
              data={ownerPointsChart.data}
              owners={ownerPointsChart.owners}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
            No match-by-match fantasy data yet. When player scorecards include{" "}
            <code className="app-code-inline">byMatch</code> entries, this chart will
            track each owner&apos;s running total after every match.
          </p>
        )}
      </section>
    </div>
  );
}
