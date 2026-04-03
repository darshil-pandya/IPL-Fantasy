import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import { ownerSlug } from "../lib/slug";
import type { PlayerNationality } from "../types";

function natLabel(n?: PlayerNationality): string {
  if (n === "IND") return "India";
  if (n === "OVS") return "Overseas";
  return "—";
}

export function Franchises() {
  const { bundle } = useLeague();
  const displaySummary = useLeagueStandings();
  const [owner, setOwner] = useState<string>("");

  const standings = useMemo(() => {
    if (!bundle || !displaySummary) return [];
    return displaySummary.standings;
  }, [bundle, displaySummary]);

  const selected = useMemo(() => {
    if (!standings.length) return null;
    const o = owner || standings[0].owner;
    return standings.find((s) => s.owner === o) ?? standings[0];
  }, [standings, owner]);

  if (!bundle || !displaySummary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Franchises</h2>
        <p className="mt-1 text-sm text-slate-400">
          Roster table by owner: player, IPL side, role, nationality, season points.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Franchise
        </span>
        <select
          value={selected?.owner ?? ""}
          onChange={(e) => setOwner(e.target.value)}
          className="max-w-md rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
        >
          {standings.map((s) => (
            <option key={s.owner} value={s.owner}>
              {s.teamName} ({s.owner})
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{selected.teamName}</h3>
            <OwnerBadge owner={selected.owner} />
            <span className="text-sm text-slate-500">
              {selected.totalPoints.toFixed(1)} season pts
            </span>
            <Link
              to={`/teams/${ownerSlug(selected.owner)}`}
              className="ml-auto text-sm font-medium text-amber-400 hover:text-amber-300"
            >
              Open squad details (match breakdown) →
            </Link>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Player</th>
                  <th className="px-3 py-3 font-medium">IPL team</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Nationality</th>
                  <th className="px-3 py-3 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[...selected.playersResolved]
                  .sort((a, b) => b.seasonTotal - a.seasonTotal)
                  .map((p) => (
                    <tr key={p.id} className="bg-slate-950/40">
                      <td className="px-3 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-3 py-3">
                        <IplTeamPill code={p.iplTeam} />
                      </td>
                      <td className="px-3 py-3">
                        <span className={roleBadgeClass(p.role)}>{p.role}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={natBadgeClass(p.nationality)}>
                          {natLabel(p.nationality)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-300/90">
                        {p.seasonTotal.toFixed(1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
