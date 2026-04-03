import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";
import { ownerForPlayerId } from "../lib/buildStandings";
import { ownerSlug } from "../lib/slug";

type SortKey = "points" | "name";

export function Players() {
  const { bundle } = useLeague();
  const [sort, setSort] = useState<SortKey>("points");

  const rows = useMemo(() => {
    if (!bundle) return [];
    const list = bundle.players.map((p) => {
      const owner = ownerForPlayerId(bundle.franchises, p.id);
      const inUnsold = bundle.auction.unsoldPlayerIds.includes(p.id);
      let status: string;
      if (owner) status = owner;
      else if (inUnsold) status = "Unsold pool";
      else status = "—";
      return { p, status, owner };
    });
    list.sort((a, b) => {
      if (sort === "points") return b.p.seasonTotal - a.p.seasonTotal;
      return a.p.name.localeCompare(b.p.name);
    });
    return list;
  }, [bundle, sort]);

  if (!bundle) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Season totals and franchise assignment for every player in{" "}
          <code className="text-amber-200/80">players.json</code>.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span className="text-slate-500">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="points">Points (high → low)</option>
            <option value="name">Name (A → Z)</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Player</th>
              <th className="px-3 py-3 font-medium">IPL</th>
              <th className="px-3 py-3 font-medium">Franchise</th>
              <th className="px-3 py-3 font-medium text-right">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map(({ p, status, owner }) => (
              <tr key={p.id} className="bg-slate-950/40 hover:bg-slate-900/50">
                <td className="px-3 py-3">
                  <span className="font-medium text-white">{p.name}</span>
                  <p className="text-xs text-slate-500">
                    {p.role} · {p.id}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-400">{p.iplTeam}</td>
                <td className="px-3 py-3">
                  {owner ? (
                    <Link
                      to={`/teams/${ownerSlug(owner)}`}
                      className="text-emerald-300 hover:text-amber-200"
                    >
                      {status}
                    </Link>
                  ) : (
                    <span className="text-slate-400">{status}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-white">
                  {p.seasonTotal.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
