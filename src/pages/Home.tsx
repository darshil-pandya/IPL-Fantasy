import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import {
  leaderBestBattingAvg,
  leaderBestBowlingAvg,
  leaderMostFantasyPoints,
  leaderMostFours,
  leaderMostSixes,
  leaderTopRuns,
  leaderTopWickets,
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

function StatCard({
  title,
  leader,
  valueSuffix,
}: {
  title: string;
  leader: StatLeader;
  valueSuffix?: string;
}) {
  return (
    <div className="rounded-xl border border-brand-cyan/50 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-dark/50">
        {title}
      </p>
      {leader ? (
        <>
          <p className="mt-2 font-semibold text-brand-dark">{leader.player.name}</p>
          <p className="mt-1 text-sm tabular-nums text-brand-ocean">
            {leader.display}
            {valueSuffix ? ` ${valueSuffix}` : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No data yet</p>
      )}
    </div>
  );
}

export function Home() {
  const { bundle, refresh, leagueNotice } = useLeague();
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

  const statLeaders = useMemo(() => {
    if (!bundle) return null;
    const players = bundle.players;
    return {
      fantasy: leaderMostFantasyPoints(players),
      runs: leaderTopRuns(players),
      wickets: leaderTopWickets(players),
      batAvg: leaderBestBattingAvg(players),
      bowlAvg: leaderBestBowlingAvg(players),
      sixes: leaderMostSixes(players),
      fours: leaderMostFours(players),
    };
  }, [bundle]);

  if (!bundle || !summary || !statLeaders) return null;

  const { meta } = bundle;
  const pred = bundle.predictions;

  return (
    <div className="space-y-8">
      {leagueNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {leagueNotice}
        </div>
      ) : null}
      <section className="app-card p-5">
        <h2 className="text-lg font-semibold text-brand-dark">{meta.seasonLabel}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {meta.pointsUpdateNote}
        </p>
        {meta.lastPointsUpdate && (
          <p className="mt-2 text-xs text-slate-500">
            Last points update:{" "}
            <time dateTime={meta.lastPointsUpdate}>{meta.lastPointsUpdate}</time>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={meta.cricbuzzBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="app-btn-primary"
          >
            Open Cricbuzz scores
          </a>
          <button type="button" onClick={() => void refresh()} className="app-btn-secondary">
            Refresh data
          </button>
          <Link to="/predictions" className="app-btn-secondary">
            Predictions
          </Link>
          <Link to="/waivers" className="app-btn-secondary">
            Waivers
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-brand-dark">Leaderboard</h2>
        <p className="mb-3 text-sm text-slate-600">
          Sorted by rank (fantasy points plus prediction bonus: {pred.pointsPerCorrect}{" "}
          pts per correct when results are set). Squad totals use live waiver rosters.
        </p>
        <div className="app-table">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="px-3 py-3 font-medium">Rank</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Best player</th>
                <th className="px-3 py-3 text-right font-medium text-brand-ocean">
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
                      className="font-medium text-brand-dark hover:text-brand-ocean"
                    >
                      {r.owner}
                    </Link>
                    <div className="mt-1">
                      <OwnerBadge owner={r.owner} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {r.bestPlayer ? (
                      <>
                        <span className="font-medium text-brand-dark">
                          {r.bestPlayer.name}
                        </span>
                        <span className="ml-2 tabular-nums text-slate-500">
                          ({r.bestPlayer.seasonTotal.toFixed(1)} pts)
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-brand-ocean">
                    {r.total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-brand-dark">Season highlights</h2>
        <p className="mb-3 text-sm text-slate-600">
          IPL counting stats come from optional{" "}
          <code className="rounded bg-brand-pale px-1 text-brand-dark">seasonStats</code> on
          each player in{" "}
          <code className="rounded bg-brand-pale px-1 text-brand-dark">players.json</code>.
          Fantasy points use{" "}
          <code className="rounded bg-brand-pale px-1 text-brand-dark">seasonTotal</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Most fantasy points"
            leader={statLeaders.fantasy}
            valueSuffix="pts"
          />
          <StatCard title="Top run scorer" leader={statLeaders.runs} valueSuffix="runs" />
          <StatCard
            title="Top wicket taker"
            leader={statLeaders.wickets}
            valueSuffix="wickets"
          />
          <StatCard
            title="Best batting average"
            leader={statLeaders.batAvg}
            valueSuffix="avg"
          />
          <StatCard
            title="Best bowling average"
            leader={statLeaders.bowlAvg}
            valueSuffix="avg"
          />
          <StatCard title="Most sixes" leader={statLeaders.sixes} valueSuffix="6s" />
          <StatCard title="Most fours" leader={statLeaders.fours} valueSuffix="4s" />
        </div>
      </section>
    </div>
  );
}
