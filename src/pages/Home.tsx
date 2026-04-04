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
import { ownerSlug } from "../lib/slug";
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {leader ? (
        <>
          <p className="mt-2 font-semibold text-white">{leader.player.name}</p>
          <p className="mt-1 text-sm tabular-nums text-emerald-300/90">
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
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          {leagueNotice}
        </div>
      ) : null}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-white">{meta.seasonLabel}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
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
            className="inline-flex items-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-slate-700"
          >
            Open Cricbuzz scores
          </a>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Refresh data
          </button>
          <Link
            to="/predictions"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Predictions
          </Link>
          <Link
            to="/waivers"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Waivers
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-white">Leaderboard</h2>
        <p className="mb-3 text-sm text-slate-400">
          Sorted by rank (fantasy points plus prediction bonus: {pred.pointsPerCorrect}{" "}
          pts per correct when results are set). Squad totals use live waiver rosters.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Rank</th>
                <th className="px-3 py-3 font-medium">Owner</th>
                <th className="px-3 py-3 font-medium">Best player</th>
                <th className="px-3 py-3 text-right font-medium text-amber-400/90">
                  Total pts
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedLeaderboard.map((r) => (
                <tr
                  key={r.owner}
                  className="bg-slate-950/40 hover:bg-slate-900/60"
                >
                  <td className="px-3 py-3 font-semibold tabular-nums text-slate-400">
                    {r.rank}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to={`/teams/${ownerSlug(r.owner)}`}
                      className="font-medium text-white hover:text-amber-200"
                    >
                      {r.owner}
                    </Link>
                    <div className="mt-1">
                      <OwnerBadge owner={r.owner} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-200">
                    {r.bestPlayer ? (
                      <>
                        <span className="font-medium text-white">
                          {r.bestPlayer.name}
                        </span>
                        <span className="ml-2 tabular-nums text-slate-500">
                          ({r.bestPlayer.seasonTotal.toFixed(1)} pts)
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-amber-200">
                    {r.total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-white">Season highlights</h2>
        <p className="mb-3 text-sm text-slate-400">
          IPL counting stats come from optional{" "}
          <code className="text-amber-200/80">seasonStats</code> on each player in{" "}
          <code className="text-amber-200/80">players.json</code>. Fantasy points use{" "}
          <code className="text-amber-200/80">seasonTotal</code>.
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
