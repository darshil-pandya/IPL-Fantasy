import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";
import { franchiseBySlug, ownerSlug } from "../lib/slug";
import type { Player } from "../types";

function MatchBreakdown({ player }: { player: Player }) {
  const [open, setOpen] = useState(false);
  if (player.byMatch.length === 0) {
    return <p className="text-xs text-slate-600">No match rows yet</p>;
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-amber-400/90 hover:text-amber-300"
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} match breakdown ({player.byMatch.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1 rounded-xl bg-slate-950/60 p-3 text-xs">
          {player.byMatch.map((m) => (
            <li
              key={`${m.matchDate}-${m.matchLabel}`}
              className="flex justify-between gap-2 border-b border-slate-800/80 py-1 last:border-0"
            >
              <span className="text-slate-400">
                <span className="text-slate-500">{m.matchDate}</span> — {m.matchLabel}
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-emerald-300">
                +{m.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamDetail() {
  const { ownerSlug: slug } = useParams<{ ownerSlug: string }>();
  const { summary } = useLeague();

  const row = useMemo(() => {
    if (!summary || !slug) return null;
    const f = franchiseBySlug(summary.standings, slug);
    if (!f) return null;
    return f;
  }, [summary, slug]);

  if (!summary) return null;

  if (!slug || !row) {
    return (
      <div className="rounded-2xl border border-slate-800 p-6 text-center text-slate-400">
        <p>Team not found.</p>
        <Link to="/teams" className="mt-3 inline-block text-amber-400 hover:underline">
          Back to teams
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/teams"
          className="text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          ← All teams
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-white">{row.teamName}</h2>
        <p className="text-slate-400">{row.owner}</p>
        <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-300">
          {row.totalPoints.toFixed(1)}{" "}
          <span className="text-lg font-normal text-slate-500">season pts</span>
        </p>
      </div>

      {row.missingPlayerIds.length > 0 && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90">
          <p className="font-medium">Missing player IDs in players.json</p>
          <p className="mt-1 text-xs text-amber-200/70">
            {row.missingPlayerIds.join(", ")}
          </p>
        </div>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Squad
        </h3>
        {row.playersResolved.length === 0 ? (
          <p className="text-sm text-slate-500">
            No players linked yet. Add <code className="text-amber-200/80">playerIds</code>{" "}
            in <code className="text-amber-200/80">franchises.json</code> and matching entries
            in <code className="text-amber-200/80">players.json</code>.
          </p>
        ) : (
          <ul className="space-y-3">
            {row.playersResolved.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.iplTeam} · {p.role}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-emerald-300">
                    {p.seasonTotal.toFixed(1)}
                  </p>
                </div>
                <MatchBreakdown player={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-600">
        Share this page:{" "}
        <span className="text-slate-500">
          …/teams/{ownerSlug(row.owner)}
        </span>
      </p>
    </div>
  );
}
