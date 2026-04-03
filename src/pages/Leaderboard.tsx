import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import { PREDICTION_ACTUALS_EVENT } from "../lib/predictionEvents";
import {
  loadStoredActuals,
  mergeActuals,
  pickForOwner,
  predictionScore,
} from "../lib/predictions";
import { ownerSlug } from "../lib/slug";

export function Leaderboard() {
  const { bundle } = useLeague();
  const summary = useLeagueStandings();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(PREDICTION_ACTUALS_EVENT, on);
    return () => window.removeEventListener(PREDICTION_ACTUALS_EVENT, on);
  }, []);

  const rows = useMemo(() => {
    if (!bundle || !summary) return [];
    const pred = bundle.predictions;
    const actuals = mergeActuals(pred.actuals, loadStoredActuals());
    return summary.sorted.map((s) => {
      const pick = pickForOwner(pred, s.owner);
      const predPts = predictionScore(pick, actuals, pred.pointsPerCorrect);
      const fantasy = s.totalPoints;
      return {
        standing: s,
        fantasy,
        predPts,
        total: fantasy + predPts,
      };
    });
  }, [bundle, summary, tick]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => b.total - a.total).map((r, i) => ({
      ...r,
      displayRank: i + 1,
    }));
  }, [rows]);

  if (!bundle || !summary) return null;

  const pred = bundle.predictions;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ranks use combined <strong className="text-slate-300">fantasy points</strong> plus{" "}
          <strong className="text-slate-300">prediction bonus</strong> (
          {pred.pointsPerCorrect} pts per correct pick when results are set). Browser saves
          draft results locally; publish{" "}
          <code className="text-amber-200/80">actuals</code> in{" "}
          <code className="text-amber-200/80">predictions.json</code> for everyone.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Franchise</th>
              <th className="px-3 py-3 text-right font-medium">Fantasy</th>
              <th className="px-3 py-3 text-right font-medium">Predictions</th>
              <th className="px-3 py-3 text-right font-medium text-amber-400/90">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedRows.map((r) => (
              <tr
                key={r.standing.owner}
                className="bg-slate-950/40 hover:bg-slate-900/60"
              >
                <td className="px-3 py-3 font-semibold tabular-nums text-slate-400">
                  {r.displayRank}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <Link
                      to={`/teams/${ownerSlug(r.standing.owner)}`}
                      className="font-medium text-white hover:text-amber-200"
                    >
                      {r.standing.teamName}
                    </Link>
                    <OwnerBadge owner={r.standing.owner} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-200">
                  {r.fantasy.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-300/90">
                  {r.predPts.toFixed(0)}
                </td>
                <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-amber-200">
                  {r.total.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
