import { useMemo, useState } from "react";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import type { FranchiseScoringMode } from "../lib/franchiseAttributedScoring";
import { pointsInMatch, type MatchColumn } from "../lib/matchColumns";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import type { FranchiseStanding, Player } from "../types";

function FranchiseMatchTable({
  standing,
  columns,
  scoringMode,
  perOwnerRounds,
  rostersAtStartOfMatch,
}: {
  standing: FranchiseStanding;
  columns: MatchColumn[];
  scoringMode: FranchiseScoringMode;
  perOwnerRounds: number[];
  rostersAtStartOfMatch: Record<string, string[]>[] | null;
}) {
  const franchiseMatchTotal = useMemo(() => {
    return perOwnerRounds.reduce((a, b) => a + b, 0);
  }, [perOwnerRounds]);

  if (columns.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No match rows yet. Add <code className="app-code-inline">byMatch</code> entries in{" "}
        <code className="app-code-inline">players.json</code> after each IPL game.
      </p>
    );
  }

  const owner = standing.owner;

  return (
    <div className="app-table">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs md:text-sm">
        <thead>
          <tr className="border-b border-cyan-500/25 bg-slate-950/95">
            <th
              scope="col"
              className="sticky left-0 z-[1] bg-slate-950 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:px-4"
            >
              Player
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Role
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            >
              IPL
            </th>
            <th
              scope="col"
              className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Type
            </th>
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="min-w-[5.5rem] px-2 py-3 text-right text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500"
              >
                <span className="block text-slate-500">{c.date}</span>
                <span className="line-clamp-2 font-normal normal-case text-slate-300">
                  {c.label}
                </span>
              </th>
            ))}
            <th
              scope="col"
              className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-amber-400"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {standing.playersResolved.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              columns={columns}
              owner={owner}
              scoringMode={scoringMode}
              rostersAtStartOfMatch={rostersAtStartOfMatch}
            />
          ))}
          <tr className="border-b border-cyan-500/20 bg-slate-950/80 font-semibold">
            <td
              colSpan={4}
              className="sticky left-0 bg-slate-950 px-3 py-3 text-white md:px-4"
            >
              Franchise match total
            </td>
            {columns.map((c, j) => (
              <td key={c.id} className="px-2 py-3 text-right tabular-nums text-slate-300">
                {(perOwnerRounds[j] ?? 0).toFixed(1)}
              </td>
            ))}
            <td className="px-3 py-3 text-right tabular-nums text-amber-400">
              {franchiseMatchTotal.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({
  player,
  columns,
  owner,
  scoringMode,
  rostersAtStartOfMatch,
}: {
  player: Player;
  columns: MatchColumn[];
  owner: string;
  scoringMode: FranchiseScoringMode;
  rostersAtStartOfMatch: Record<string, string[]>[] | null;
}) {
  const rowMatchTotal = useMemo(() => {
    let t = 0;
    columns.forEach((c, j) => {
      const onRoster =
        scoringMode === "legacy" ||
        (rostersAtStartOfMatch != null &&
          (rostersAtStartOfMatch[j]?.[owner]?.includes(player.id) ?? false));
      if (!onRoster) return;
      const pts = pointsInMatch(player, c.id);
      if (pts != null) t += pts;
    });
    return t;
  }, [player, columns, owner, scoringMode, rostersAtStartOfMatch]);

  return (
    <tr className="app-table-row border-brand-cyan/25">
      <td className="sticky left-0 z-[1] bg-slate-900 px-3 py-2.5 font-medium text-white shadow-[2px_0_12px_-2px_rgba(0,0,0,0.5)] md:px-4">
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
      {columns.map((c, j) => {
        const onRoster =
          scoringMode === "legacy" ||
          (rostersAtStartOfMatch != null &&
            (rostersAtStartOfMatch[j]?.[owner]?.includes(player.id) ?? false));
        const pts = pointsInMatch(player, c.id);
        const show = onRoster && pts != null;
        return (
          <td
            key={c.id}
            className={`px-2 py-2.5 text-right tabular-nums ${
              onRoster ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {show ? pts.toFixed(1) : "—"}
          </td>
        );
      })}
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-amber-400">
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

  const columns: MatchColumn[] = displaySummary?.columns ?? [];

  const filteredStandings = useMemo(() => {
    if (franchise === "all") return standings;
    return standings.filter((s) => s.owner === franchise);
  }, [standings, franchise]);

  if (!bundle || !displaySummary) return null;

  const scoringMode = displaySummary.mode;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-white">Match Center</h2>
          <p className="mt-1 text-sm text-slate-400">
            Match-by-match fantasy matrix. Scroll horizontally on mobile.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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

      {scoringMode === "legacy" ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm text-amber-100/90">
          Legacy scoring: waiver history does not replay to current rosters, so totals may use
          older carryover rules. After the next successful waiver reveal, attributed scoring
          should apply.
        </p>
      ) : null}

      {filteredStandings.map((s) => (
        <section key={s.owner} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">{s.owner}</h3>
              <OwnerBadge owner={s.owner} />
            </div>
            <span className="rounded-full border border-cyan-500/30 bg-slate-900/80 px-3 py-1 text-xs text-cyan-200">
              Fantasy total (leaderboard): {s.totalPoints.toFixed(1)} pts
            </span>
          </div>
          <FranchiseMatchTable
            standing={s}
            columns={columns}
            scoringMode={scoringMode}
            perOwnerRounds={displaySummary.perOwnerPerMatch[s.owner] ?? []}
            rostersAtStartOfMatch={displaySummary.rostersAtStartOfMatch}
          />
        </section>
      ))}

      <p className="text-xs leading-relaxed text-slate-500">
        Cells count toward a franchise only for matches while that player was on the roster
        (same engine as Home). <code className="app-code-inline">—</code> means no points for
        that franchise that match. Row totals are the sum of attributed cells only.
      </p>
    </div>
  );
}
