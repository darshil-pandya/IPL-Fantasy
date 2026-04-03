import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";
import { ownerSlug } from "../lib/slug";

export function Teams() {
  const { summary } = useLeague();
  if (!summary) return null;
  const { sorted } = summary;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Tap a franchise to see the full squad and match-by-match fantasy points.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map((f) => (
          <li key={f.owner}>
            <Link
              to={`/teams/${ownerSlug(f.owner)}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition-colors hover:border-emerald-800/80 hover:bg-slate-900/70"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
                {f.owner}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">{f.teamName}</h2>
              <p className="mt-3 text-2xl font-bold tabular-nums text-emerald-300">
                {f.totalPoints.toFixed(1)}{" "}
                <span className="text-sm font-normal text-slate-500">pts</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {f.playersResolved.length} players in squad
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
