import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import { Link } from "react-router-dom";
import { OwnerBadge } from "../components/OwnerBadge";
import { ownerSlug } from "../lib/slug";

export function Home() {
  const { bundle, refresh, leagueNotice } = useLeague();
  const summary = useLeagueStandings();
  if (!bundle || !summary) return null;

  const { meta } = bundle;
  const { sorted } = summary;
  const top3 = sorted.slice(0, 3);

  return (
    <div className="space-y-8">
      {leagueNotice ? (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          {leagueNotice}
        </div>
      ) : null}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-white">{bundle.meta.seasonLabel}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {bundle.meta.pointsUpdateNote}
        </p>
        {bundle.meta.lastPointsUpdate && (
          <p className="mt-2 text-xs text-slate-500">
            Last points update:{" "}
            <time dateTime={bundle.meta.lastPointsUpdate}>
              {bundle.meta.lastPointsUpdate}
            </time>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={bundle.meta.cricbuzzBaseUrl}
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
            to="/leaderboard"
            className="rounded-xl bg-emerald-800/40 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-600/40 hover:bg-emerald-800/60"
          >
            Full leaderboard
          </Link>
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
        <h2 className="mb-3 text-lg font-semibold text-white">Top franchises</h2>
        <p className="mb-3 text-sm text-slate-500">
          Fantasy totals include live waiver rosters and carryover from released players;
          prediction bonus is on the leaderboard.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium text-right">Fantasy pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {top3.map((row, i) => (
                <tr key={row.owner} className="bg-slate-950/40 hover:bg-slate-900/60">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/teams/${ownerSlug(row.owner)}`}
                      className="font-medium text-white hover:text-amber-200"
                    >
                      {row.teamName}
                    </Link>
                    <div className="mt-1">
                      <OwnerBadge owner={row.owner} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">
                    {row.totalPoints.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
