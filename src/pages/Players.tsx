import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useWaiver } from "../context/WaiverContext";
import { ownerForPlayerId } from "../lib/buildStandings";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import {
  breakdownMatchesSeasonTotal,
  countPlayersWithBreakdownIssues,
} from "../lib/playerFantasyPoints";
import { ownerNameClass } from "../lib/ownerTheme";
import type { LeagueBundle, Player, PlayerNationality } from "../types";

const BREAKDOWN_EPSILON = 0.15;

type SortKey = "points" | "name" | "franchise" | "iplTeam" | "delta";

function natLabel(n?: PlayerNationality): string {
  if (n === "IND") return "India";
  if (n === "OVS") return "Overseas";
  return "—";
}

/** Display fantasy points; negatives allowed. */
function fmtPts(n?: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function fp(p: Player) {
  return p.seasonFantasyPoints;
}

function allPlayersInLeague(bundle: LeagueBundle): Player[] {
  const m = new Map<string, Player>();
  for (const p of bundle.players) m.set(p.id, p);
  for (const p of bundle.waiverPool ?? []) {
    if (!m.has(p.id)) m.set(p.id, p);
  }
  return [...m.values()];
}

function franchiseCell(
  bundle: LeagueBundle,
  franchises: { owner: string; playerIds: string[] }[],
  playerId: string,
): { label: string; owner: string | null } {
  const owner = ownerForPlayerId(franchises, playerId);
  if (owner) return { label: owner, owner };
  if (bundle.auction.unsoldPlayerIds.includes(playerId)) {
    return { label: "Unsold", owner: null };
  }
  return { label: "Available", owner: null };
}

type PtCol = {
  key: string;
  label: string;
  title: string;
  get: (p: Player) => number | undefined;
};

const FANTASY_POINT_COLUMNS: PtCol[] = [
  {
    key: "batRuns",
    label: "Run",
    title: "Fantasy points from runs (+1 per run)",
    get: (p) => fp(p)?.battingRuns,
  },
  {
    key: "4s",
    label: "4s",
    title: "Boundary four bonus points (+2 each)",
    get: (p) => fp(p)?.boundaryFours,
  },
  {
    key: "6s",
    label: "6s",
    title: "Six bonus points (+4 each)",
    get: (p) => fp(p)?.boundarySixes,
  },
  {
    key: "mil",
    label: "Mil",
    title: "Milestone bonuses (25/50/75/100), net of stacking rules",
    get: (p) => fp(p)?.battingMilestones,
  },
  {
    key: "duck",
    label: "Duck",
    title: "Duck penalties (negative)",
    get: (p) => fp(p)?.ducks,
  },
  {
    key: "dot",
    label: "Dot",
    title: "Dot-ball points (+1 each)",
    get: (p) => fp(p)?.dotBalls,
  },
  {
    key: "w",
    label: "W",
    title: "Wicket points (+25 each, excl. run out)",
    get: (p) => fp(p)?.wickets,
  },
  {
    key: "lbw",
    label: "LBW",
    title: "LBW/bowled bonus points (+8 each)",
    get: (p) => fp(p)?.lbwOrBowled,
  },
  {
    key: "3w",
    label: "3W",
    title: "3-wicket haul bonus points",
    get: (p) => fp(p)?.threeWicketHauls,
  },
  {
    key: "4w",
    label: "4W",
    title: "4-wicket haul bonus points",
    get: (p) => fp(p)?.fourWicketHauls,
  },
  {
    key: "5w",
    label: "5W",
    title: "5-wicket haul bonus points",
    get: (p) => fp(p)?.fiveWicketHauls,
  },
  {
    key: "mdn",
    label: "Mdn",
    title: "Maiden over points (+12 each)",
    get: (p) => fp(p)?.maidens,
  },
  {
    key: "eco",
    label: "Eco",
    title: "Net economy-rate band points (can be negative)",
    get: (p) => fp(p)?.economy,
  },
  {
    key: "sr",
    label: "SR",
    title: "Net strike-rate band points (can be negative)",
    get: (p) => fp(p)?.strikeRate,
  },
  {
    key: "ct",
    label: "Ct",
    title: "Catch points (+8 each)",
    get: (p) => fp(p)?.catches,
  },
  {
    key: "3ct",
    label: "3Ct+",
    title: "3-catch bonus points (+4 per match when earned)",
    get: (p) => fp(p)?.threeCatchBonus,
  },
  {
    key: "st",
    label: "St",
    title: "Stumping points (+12 each)",
    get: (p) => fp(p)?.stumpings,
  },
  {
    key: "roD",
    label: "RO†",
    title: "Run out direct (+12 each)",
    get: (p) => fp(p)?.runOutDirect,
  },
  {
    key: "roA",
    label: "RO*",
    title: "Run out assist (+6 each)",
    get: (p) => fp(p)?.runOutAssist,
  },
  {
    key: "xi",
    label: "XI",
    title: "Named in XI (+4 each appearance)",
    get: (p) => fp(p)?.namedInXi,
  },
  {
    key: "imp",
    label: "Imp",
    title: "Impact/concussion sub (+4 each)",
    get: (p) => fp(p)?.impactOrConcussion,
  },
  {
    key: "oth",
    label: "Oth",
    title: "Other manual adjustments",
    get: (p) => fp(p)?.other,
  },
];

export function Players() {
  const { bundle } = useLeague();
  const { displayFranchises } = useWaiver();
  const [sort, setSort] = useState<SortKey>("points");

  const pool = useMemo(
    () => (bundle ? allPlayersInLeague(bundle) : []),
    [bundle],
  );

  const breakdownIssueCount = useMemo(
    () => countPlayersWithBreakdownIssues(pool, BREAKDOWN_EPSILON),
    [pool],
  );

  const rows = useMemo(() => {
    if (!bundle) return [];
    const list = pool.map((p) => {
      const fc = franchiseCell(bundle, displayFranchises, p.id);
      const br = breakdownMatchesSeasonTotal(p, BREAKDOWN_EPSILON);
      return { p, fc, br };
    });
    list.sort((a, b) => {
      if (sort === "points") return b.p.seasonTotal - a.p.seasonTotal;
      if (sort === "name") return a.p.name.localeCompare(b.p.name);
      if (sort === "iplTeam") {
        return (
          a.p.iplTeam.localeCompare(b.p.iplTeam) ||
          a.p.name.localeCompare(b.p.name)
        );
      }
      if (sort === "delta") {
        const da = a.br.checked ? Math.abs(a.br.delta) : -1;
        const db = b.br.checked ? Math.abs(b.br.delta) : -1;
        return db - da || b.p.seasonTotal - a.p.seasonTotal;
      }
      return a.fc.label.localeCompare(b.fc.label) || a.p.name.localeCompare(b.p.name);
    });
    return list;
  }, [bundle, displayFranchises, pool, sort]);

  if (!bundle) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Players</h2>
        <p className="mt-1 text-sm text-slate-400">
          Every player in <code className="text-amber-200/80">players.json</code> plus the
          waiver pool. <strong className="text-slate-300">Category columns are fantasy
          points</strong> (can be negative). Cumulative over the IPL season; update after each
          match. Optional raw counting stats for Home highlights stay in{" "}
          <code className="text-amber-200/80">seasonStats</code>; point buckets live in{" "}
          <code className="text-amber-200/80">seasonFantasyPoints</code> (see{" "}
          <code className="text-amber-200/80">types.ts</code>).
        </p>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
          <p className="font-medium text-slate-300">Franchise totals &amp; waivers</p>
          <p className="mt-2 leading-relaxed">
            A franchise&apos;s fantasy total is the sum of <code className="text-slate-500">seasonTotal</code> for
            every player <em>currently</em> on its roster, plus{" "}
            <strong className="text-slate-300">waiver carryover</strong>. On waiver reveal,
            the outgoing player&apos;s <code className="text-slate-500">seasonTotal</code> at that
            moment is added to carryover so those points are not lost when the roster
            changes. Incoming players contribute their current <code className="text-slate-500">seasonTotal</code> from
            data. Player rows here always show the full player record — ownership does not
            reset individual scoring.
          </p>
        </div>
        {breakdownIssueCount > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-900/60 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/90">
            <strong className="text-amber-200">{breakdownIssueCount}</strong> player
            {breakdownIssueCount === 1 ? "" : "s"} have{" "}
            <code className="text-amber-200/90">seasonFantasyPoints</code> filled but the sum
            differs from <code className="text-amber-200/90">seasonTotal</code> by more than{" "}
            {BREAKDOWN_EPSILON} pts (see Δ column). Either adjust buckets or{" "}
            <code className="text-amber-200/90">seasonTotal</code> so they match — the table
            treats <code className="text-amber-200/90">seasonTotal</code> as the authoritative
            fantasy total for standings.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span className="text-slate-500">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="points">Fantasy pts (high → low)</option>
            <option value="name">Name (A → Z)</option>
            <option value="franchise">Franchise (A → Z)</option>
            <option value="iplTeam">IPL team (A → Z)</option>
            <option value="delta">Breakdown mismatch (largest Δ first)</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[1200px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
              <th
                scope="col"
                className="sticky left-0 z-[2] bg-slate-900/95 px-2 py-2 font-medium sm:px-3 sm:py-3"
              >
                Player
              </th>
              <th scope="col" className="px-2 py-2 font-medium sm:px-3 sm:py-3">
                Franchise
              </th>
              <th scope="col" className="px-2 py-2 font-medium sm:px-3 sm:py-3">
                IPL
              </th>
              <th scope="col" className="px-2 py-2 font-medium sm:px-3 sm:py-3">
                Role
              </th>
              <th scope="col" className="px-2 py-2 font-medium sm:px-3 sm:py-3">
                Nat
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-right font-medium text-amber-400/90 sm:px-3 sm:py-3"
                title="Authoritative fantasy total (standings use this)"
              >
                Total
              </th>
              {FANTASY_POINT_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  className="min-w-[2.6rem] px-1.5 py-2 text-right font-medium sm:px-2 sm:py-3"
                >
                  <span className="cursor-help border-b border-dotted border-slate-600">
                    {c.label}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="px-2 py-2 text-right font-medium text-slate-400 sm:px-3 sm:py-3"
                title="seasonTotal minus sum of category points (should be ~0 if breakdown is complete)"
              >
                Δ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(({ p, fc, br }) => {
              const mismatch = br.checked && !br.inSync;
              return (
                <tr
                  key={p.id}
                  className={
                    mismatch
                      ? "bg-rose-950/15 hover:bg-rose-950/25"
                      : "bg-slate-950/40 hover:bg-slate-900/50"
                  }
                >
                  <td className="sticky left-0 z-[1] bg-slate-950/95 px-2 py-2 font-medium text-white sm:bg-slate-950/90 sm:px-3 sm:py-2.5">
                    <span title={p.id}>{p.name}</span>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5">
                    {fc.owner ? (
                      <Link
                        to={`/teams?owner=${encodeURIComponent(fc.owner)}`}
                        className={`inline-flex flex-wrap items-center gap-2 ${ownerNameClass(fc.owner)} hover:opacity-90`}
                      >
                        <OwnerBadge owner={fc.owner} />
                      </Link>
                    ) : (
                      <span className="text-slate-400">{fc.label}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5">
                    <IplTeamPill code={p.iplTeam} />
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5">
                    <span className={roleBadgeClass(p.role)}>{p.role}</span>
                  </td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5">
                    <span className={natBadgeClass(p.nationality)}>
                      {natLabel(p.nationality)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-white sm:px-3 sm:py-2.5">
                    {p.seasonTotal.toFixed(1)}
                  </td>
                  {FANTASY_POINT_COLUMNS.map((c) => (
                    <td
                      key={c.key}
                      className="px-1.5 py-2 text-right tabular-nums text-slate-300 sm:px-2 sm:py-2.5"
                    >
                      {fmtPts(c.get(p))}
                    </td>
                  ))}
                  <td
                    className={`px-2 py-2 text-right text-xs tabular-nums sm:px-3 sm:py-2.5 ${
                      mismatch ? "font-semibold text-rose-300" : "text-slate-500"
                    }`}
                  >
                    {!br.checked
                      ? "—"
                      : br.inSync
                        ? "✓"
                        : (br.delta >= 0 ? "+" : "") + br.delta.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-slate-600">
        <strong className="text-slate-500">Reconciliation:</strong> If every scoring source is
        assigned to exactly one bucket, the sum of <code className="text-slate-500">seasonFantasyPoints</code> fields
        should equal <code className="text-slate-500">seasonTotal</code>. If you also track points only in{" "}
        <code className="text-slate-500">byMatch</code> without a breakdown, leave{" "}
        <code className="text-slate-500">seasonFantasyPoints</code> empty (Δ shows —). Prediction
        bonuses are franchise-level, not in player totals.
      </p>
    </div>
  );
}
