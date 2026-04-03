import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext";
import { buildStandings } from "../lib/buildStandings";
import {
  matchColumnsFromPlayers,
  pointsInMatch,
  type MatchColumn,
} from "../lib/matchColumns";
import type { FranchiseStanding, Player, PlayerNationality, PlayerRole } from "../types";

function roleBadgeClass(role: PlayerRole): string {
  const base =
    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  switch (role) {
    case "BAT":
      return `${base} bg-sky-600/35 text-sky-200 ring-1 ring-sky-500/40`;
    case "BOWL":
      return `${base} bg-rose-700/35 text-rose-100 ring-1 ring-rose-500/40`;
    case "AR":
      return `${base} bg-emerald-700/35 text-emerald-100 ring-1 ring-emerald-500/40`;
    case "WK":
      return `${base} bg-amber-600/35 text-amber-100 ring-1 ring-amber-500/40`;
  }
}

function natBadgeClass(n?: PlayerNationality): string | null {
  if (!n) return null;
  const base =
    "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  return n === "IND"
    ? `${base} bg-emerald-800/40 text-emerald-100 ring-1 ring-emerald-600/35`
    : `${base} bg-violet-800/40 text-violet-100 ring-1 ring-violet-500/35`;
}

function FranchiseMatchTable({
  standing,
  columns,
}: {
  standing: FranchiseStanding;
  columns: MatchColumn[];
}) {
  const franchiseMatchTotal = useMemo(() => {
    if (columns.length === 0) return 0;
    let t = 0;
    for (const p of standing.playersResolved) {
      for (const c of columns) {
        const pts = pointsInMatch(p, c.id);
        if (pts != null) t += pts;
      }
    }
    return t;
  }, [standing.playersResolved, columns]);

  if (columns.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No match rows yet. Add{" "}
        <code className="text-amber-200/80">byMatch</code> entries in{" "}
        <code className="text-amber-200/80">players.json</code> after each IPL game.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs md:text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/90">
            <th
              scope="col"
              className="sticky left-0 z-[1] bg-slate-900/95 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:px-4"
            >
              Player
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              IPL
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Type
            </th>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="min-w-[5.5rem] px-2 py-3 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400"
              >
                <span className="block text-slate-500">{c.date}</span>
                <span className="line-clamp-2 font-normal normal-case text-slate-300">
                  {c.label}
                </span>
              </th>
            ))}
            <th
              scope="col"
              className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-amber-400/90"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {standing.playersResolved.map((p) => (
            <PlayerRow key={p.id} player={p} columns={columns} />
          ))}
          <tr className="bg-slate-900/50 font-semibold">
            <td
              colSpan={4}
              className="sticky left-0 bg-slate-900/95 px-3 py-3 text-slate-300 md:px-4"
            >
              Franchise match total
            </td>
            {columns.map((c) => (
              <td key={c.id} className="px-2 py-3 text-right tabular-nums text-slate-200">
                {columnSum(standing.playersResolved, c.id).toFixed(1)}
              </td>
            ))}
            <td className="px-3 py-3 text-right tabular-nums text-amber-200">
              {franchiseMatchTotal.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function columnSum(players: Player[], colId: string): number {
  let s = 0;
  for (const p of players) {
    const pts = pointsInMatch(p, colId);
    if (pts != null) s += pts;
  }
  return s;
}

function PlayerRow({ player, columns }: { player: Player; columns: MatchColumn[] }) {
  const rowMatchTotal = useMemo(() => {
    let t = 0;
    for (const c of columns) {
      const pts = pointsInMatch(player, c.id);
      if (pts != null) t += pts;
    }
    return t;
  }, [player, columns]);

  return (
    <tr className="bg-slate-950/30 hover:bg-slate-900/40">
      <td className="sticky left-0 z-[1] bg-slate-950/90 px-3 py-2.5 font-medium text-white md:bg-slate-950/95 md:px-4">
        {player.name}
      </td>
      <td className="px-2 py-2.5">
        <span className={roleBadgeClass(player.role)}>{player.role}</span>
      </td>
      <td className="px-2 py-2.5 text-slate-400">{player.iplTeam}</td>
      <td className="px-2 py-2.5">
        {player.nationality ? (
          <span className={natBadgeClass(player.nationality)!}>
            {player.nationality}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      {columns.map((c) => {
        const pts = pointsInMatch(player, c.id);
        return (
          <td
            key={c.id}
            className="px-2 py-2.5 text-right tabular-nums text-slate-200"
          >
            {pts != null ? pts.toFixed(1) : "—"}
          </td>
        );
      })}
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-emerald-300/90">
        {rowMatchTotal.toFixed(1)}
      </td>
    </tr>
  );
}

export function MatchPoints() {
  const { bundle } = useLeague();
  const [franchise, setFranchise] = useState<string>("all");

  const standings = useMemo(() => {
    if (!bundle) return [];
    return buildStandings(bundle.franchises, bundle.players);
  }, [bundle]);

  const columns = useMemo(() => {
    if (!bundle) return [];
    return matchColumnsFromPlayers(bundle.players);
  }, [bundle]);

  const filteredStandings = useMemo(() => {
    if (franchise === "all") return standings;
    return standings.filter((s) => s.owner === franchise);
  }, [standings, franchise]);

  if (!bundle) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Match-wise points</h2>
          <p className="mt-1 text-sm text-slate-400">
            Matrix of fantasy points per IPL match. Scroll horizontally on mobile.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Franchise
          </span>
          <select
            value={franchise}
            onChange={(e) => setFranchise(e.target.value)}
            className="min-w-[12rem] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
          >
            <option value="all">All franchises</option>
            {bundle.franchises.map((f) => (
              <option key={f.owner} value={f.owner}>
                {f.teamName} ({f.owner})
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredStandings.map((s) => (
        <section key={s.owner} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-white">
              {s.teamName}
              <span className="ml-2 text-sm font-normal text-slate-500">
                {s.owner}
              </span>
            </h3>
            <span className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
              Season total (from data): {s.totalPoints.toFixed(1)} pts
            </span>
          </div>
          <FranchiseMatchTable standing={s} columns={columns} />
        </section>
      ))}

      <p className="text-xs leading-relaxed text-slate-600">
        Row and franchise totals sum only the match columns shown (every distinct{" "}
        <code className="text-slate-500">byMatch</code> row across the league). Keep{" "}
        <code className="text-slate-500">seasonTotal</code> in sync with those rows so
        the Home standings match this table.
      </p>
    </div>
  );
}
