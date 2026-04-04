import { useMemo, useState } from "react";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import {
  matchColumnsFromPlayers,
  pointsInMatch,
  type MatchColumn,
} from "../lib/matchColumns";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import type { FranchiseStanding, Player } from "../types";

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
      <p className="text-sm text-slate-600">
        No match rows yet. Add{" "}
        <code className="rounded bg-brand-pale px-1 text-brand-dark">byMatch</code> entries in{" "}
        <code className="rounded bg-brand-pale px-1 text-brand-dark">players.json</code> after each IPL game.
      </p>
    );
  }

  return (
    <div className="app-table">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs md:text-sm">
        <thead>
          <tr className="border-b border-brand-cyan/50 bg-brand-pale/90">
            <th
              scope="col"
              className="sticky left-0 z-[1] bg-brand-pale/95 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-brand-dark/60 md:px-4"
            >
              Player
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-brand-dark/60"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-brand-dark/60"
            >
              IPL
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-brand-dark/60"
            >
              Type
            </th>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="min-w-[5.5rem] px-2 py-3 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-brand-dark/50"
              >
                <span className="block text-slate-500">{c.date}</span>
                <span className="line-clamp-2 font-normal normal-case text-brand-dark/80">
                  {c.label}
                </span>
              </th>
            ))}
            <th
              scope="col"
              className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-brand-ocean"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {standing.playersResolved.map((p) => (
            <PlayerRow key={p.id} player={p} columns={columns} />
          ))}
          <tr className="border-b border-brand-cyan/30 bg-brand-pale/50 font-semibold">
            <td
              colSpan={4}
              className="sticky left-0 bg-brand-pale/90 px-3 py-3 text-brand-dark md:px-4"
            >
              Franchise match total
            </td>
            {columns.map((c) => (
              <td key={c.id} className="px-2 py-3 text-right tabular-nums text-slate-700">
                {columnSum(standing.playersResolved, c.id).toFixed(1)}
              </td>
            ))}
            <td className="px-3 py-3 text-right tabular-nums text-brand-ocean">
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
    <tr className="border-b border-brand-cyan/25 bg-white hover:bg-brand-pale/30">
      <td className="sticky left-0 z-[1] bg-white px-3 py-2.5 font-medium text-brand-dark shadow-[2px_0_6px_-2px_rgba(2,62,138,0.08)] md:bg-white md:px-4">
        {player.name}
      </td>
      <td className="px-2 py-2.5">
        <span className={roleBadgeClass(player.role)}>{player.role}</span>
      </td>
      <td className="px-2 py-2.5">
        <IplTeamPill code={player.iplTeam} />
      </td>
      <td className="px-2 py-2.5">
        <span className={natBadgeClass(player.nationality)}>
          {player.nationality ?? "—"}
        </span>
      </td>
      {columns.map((c) => {
        const pts = pointsInMatch(player, c.id);
        return (
          <td
            key={c.id}
            className="px-2 py-2.5 text-right tabular-nums text-slate-700"
          >
            {pts != null ? pts.toFixed(1) : "—"}
          </td>
        );
      })}
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-brand-ocean">
        {rowMatchTotal.toFixed(1)}
      </td>
    </tr>
  );
}

export function MatchPoints() {
  const { bundle } = useLeague();
  const displaySummary = useLeagueStandings();
  const [franchise, setFranchise] = useState<string>("all");

  const standings = useMemo(() => {
    return displaySummary?.standings ?? [];
  }, [displaySummary]);

  const columns = useMemo(() => {
    if (!bundle) return [];
    return matchColumnsFromPlayers(bundle.players);
  }, [bundle]);

  const filteredStandings = useMemo(() => {
    if (franchise === "all") return standings;
    return standings.filter((s) => s.owner === franchise);
  }, [standings, franchise]);

  if (!bundle || !displaySummary) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-dark">Match Center</h2>
          <p className="mt-1 text-sm text-slate-600">
            Match-by-match fantasy matrix. Scroll horizontally on mobile.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-brand-dark/90">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/50">
            Owner
          </span>
          <select
            value={franchise}
            onChange={(e) => setFranchise(e.target.value)}
            className="app-input min-w-[12rem] py-2.5"
          >
            <option value="all">All owners</option>
            {bundle.franchises.map((f) => (
              <option key={f.owner} value={f.owner}>
                {f.owner}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredStandings.map((s) => (
        <section key={s.owner} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-brand-dark">{s.owner}</h3>
              <OwnerBadge owner={s.owner} />
            </div>
            <span className="rounded-full border border-brand-cyan/50 bg-brand-pale/80 px-3 py-1 text-xs text-brand-dark">
              Season total (from data): {s.totalPoints.toFixed(1)} pts
            </span>
          </div>
          <FranchiseMatchTable standing={s} columns={columns} />
        </section>
      ))}

      <p className="text-xs leading-relaxed text-slate-500">
        Row and franchise totals sum only the match columns shown (every distinct{" "}
        <code className="rounded bg-brand-pale px-1">byMatch</code> row across the league). Keep{" "}
        <code className="rounded bg-brand-pale px-1">seasonTotal</code> in sync with those rows so
        the Home standings match this table.
      </p>
    </div>
  );
}
