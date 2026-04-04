import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useWaiver } from "../context/WaiverContext";
import { ownerForPlayerId } from "../lib/buildStandings";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import { ownerNameClass } from "../lib/ownerTheme";
import type { LeagueBundle, Player, PlayerNationality } from "../types";

type SortKey = "points" | "name" | "franchise" | "iplTeam";

function natLabel(n?: PlayerNationality): string {
  if (n === "IND") return "India";
  if (n === "OVS") return "Overseas";
  return "—";
}

function fmtInt(n?: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n));
}

function fmtDec(n?: number, d = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(d);
}

function strikeDisplay(p: Player): string {
  const s = p.seasonStats;
  if (!s) return "—";
  if (s.strikeRate != null && !Number.isNaN(s.strikeRate)) {
    return s.strikeRate.toFixed(2);
  }
  if (s.runs != null && s.ballsFaced != null && s.ballsFaced > 0) {
    return ((s.runs / s.ballsFaced) * 100).toFixed(2);
  }
  return "—";
}

function economyDisplay(p: Player): string {
  const s = p.seasonStats;
  if (!s) return "—";
  if (s.economy != null && !Number.isNaN(s.economy)) {
    return s.economy.toFixed(2);
  }
  if (
    s.runsConceded != null &&
    s.oversBowled != null &&
    s.oversBowled > 0
  ) {
    return (s.runsConceded / s.oversBowled).toFixed(2);
  }
  return "—";
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

type StatCol = {
  key: string;
  label: string;
  title: string;
  render: (p: Player) => string;
};

const STAT_COLUMNS: StatCol[] = [
  {
    key: "runs",
    label: "Runs",
    title: "Runs scored (+1 per run)",
    render: (p) => fmtInt(p.seasonStats?.runs),
  },
  {
    key: "balls",
    label: "Balls",
    title: "Balls faced (for strike rate bands)",
    render: (p) => fmtInt(p.seasonStats?.ballsFaced),
  },
  {
    key: "sr",
    label: "SR",
    title: "Strike rate (per 100 balls) or derived",
    render: (p) => strikeDisplay(p),
  },
  {
    key: "4s",
    label: "4s",
    title: "Fours (+2 boundary bonus each)",
    render: (p) => fmtInt(p.seasonStats?.fours),
  },
  {
    key: "6s",
    label: "6s",
    title: "Sixes (+4 each)",
    render: (p) => fmtInt(p.seasonStats?.sixes),
  },
  {
    key: "ducks",
    label: "Ducks",
    title: "Dismissals for duck (BAT/WK/AR, −2)",
    render: (p) => fmtInt(p.seasonStats?.ducks),
  },
  {
    key: "dots",
    label: "Dots",
    title: "Dot balls bowled (+1)",
    render: (p) => fmtInt(p.seasonStats?.dotBalls),
  },
  {
    key: "wkts",
    label: "Wkts",
    title: "Wickets excl. run out (+25)",
    render: (p) => fmtInt(p.seasonStats?.wickets),
  },
  {
    key: "lbw",
    label: "LBW/B",
    title: "Wickets LBW or bowled (+8)",
    render: (p) => fmtInt(p.seasonStats?.lbwOrBowled),
  },
  {
    key: "3w",
    label: "3W",
    title: "3-wicket hauls (+4)",
    render: (p) => fmtInt(p.seasonStats?.threeWHauls),
  },
  {
    key: "4w",
    label: "4W",
    title: "4-wicket hauls (+8)",
    render: (p) => fmtInt(p.seasonStats?.fourWHauls),
  },
  {
    key: "5w",
    label: "5W",
    title: "5-wicket hauls (+16)",
    render: (p) => fmtInt(p.seasonStats?.fiveWHauls),
  },
  {
    key: "mdn",
    label: "Mdns",
    title: "Maiden overs (+12)",
    render: (p) => fmtInt(p.seasonStats?.maidens),
  },
  {
    key: "ovs",
    label: "Overs",
    title: "Overs bowled (economy bands)",
    render: (p) => fmtDec(p.seasonStats?.oversBowled, 2),
  },
  {
    key: "conc",
    label: "Conc",
    title: "Runs conceded",
    render: (p) => fmtInt(p.seasonStats?.runsConceded),
  },
  {
    key: "eco",
    label: "Eco",
    title: "Economy (rpo) or derived",
    render: (p) => economyDisplay(p),
  },
  {
    key: "batAvg",
    label: "Bat Avg",
    title: "Batting average (reference)",
    render: (p) => fmtDec(p.seasonStats?.battingAvg, 2),
  },
  {
    key: "bowlAvg",
    label: "Bowl Avg",
    title: "Bowling average (reference)",
    render: (p) => fmtDec(p.seasonStats?.bowlingAvg, 2),
  },
  {
    key: "ct",
    label: "Ct",
    title: "Catches (+8; +4 bonus at 3+)",
    render: (p) => fmtInt(p.seasonStats?.catches),
  },
  {
    key: "st",
    label: "St",
    title: "Stumpings (+12)",
    render: (p) => fmtInt(p.seasonStats?.stumpings),
  },
  {
    key: "roDir",
    label: "RO†",
    title: "Run out direct hit (+12)",
    render: (p) => fmtInt(p.seasonStats?.runOutDirect),
  },
  {
    key: "roAst",
    label: "RO*",
    title: "Run out not direct (+6)",
    render: (p) => fmtInt(p.seasonStats?.runOutAssist),
  },
  {
    key: "xi",
    label: "XI",
    title: "Named in announced XI (+4)",
    render: (p) => fmtInt(p.seasonStats?.namedInXi),
  },
  {
    key: "imp",
    label: "Imp",
    title: "Impact / concussion sub (+4)",
    render: (p) => fmtInt(p.seasonStats?.impactOrConcussion),
  },
];

export function Players() {
  const { bundle } = useLeague();
  const { displayFranchises } = useWaiver();
  const [sort, setSort] = useState<SortKey>("points");

  const rows = useMemo(() => {
    if (!bundle) return [];
    const list = allPlayersInLeague(bundle).map((p) => {
      const fc = franchiseCell(bundle, displayFranchises, p.id);
      return { p, fc };
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
      return a.fc.label.localeCompare(b.fc.label) || a.p.name.localeCompare(b.p.name);
    });
    return list;
  }, [bundle, displayFranchises, sort]);

  if (!bundle) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Players</h2>
        <p className="mt-1 text-sm text-slate-400">
          Every player in <code className="text-amber-200/80">players.json</code> plus the
          waiver pool. Stat columns match scoring in{" "}
          <code className="text-amber-200/80">rules.json</code> — fill optional{" "}
          <code className="text-amber-200/80">seasonStats</code> per player as you track the
          season.
        </p>
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
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[1400px] border-collapse text-left text-xs sm:text-sm">
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
              >
                Pts
              </th>
              {STAT_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  className="min-w-[2.75rem] px-1.5 py-2 text-right font-medium sm:px-2 sm:py-3"
                >
                  <span className="cursor-help border-b border-dotted border-slate-600">
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(({ p, fc }) => (
              <tr key={p.id} className="bg-slate-950/40 hover:bg-slate-900/50">
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
                {STAT_COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="px-1.5 py-2 text-right tabular-nums text-slate-300 sm:px-2 sm:py-2.5"
                  >
                    {c.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
