import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

export function Teams() {
  const { bundle } = useLeague();
  const displaySummary = useLeagueStandings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [owner, setOwner] = useState<string>("");

  const ownersByPoints = useMemo(() => {
    if (!displaySummary) return [];
    return displaySummary.sorted;
  }, [displaySummary]);

  useEffect(() => {
    const q = searchParams.get("owner");
    if (!q || ownersByPoints.length === 0) return;
    const decoded = decodeURIComponent(q);
    if (ownersByPoints.some((s) => s.owner === decoded)) {
      setOwner(decoded);
    }
  }, [searchParams, ownersByPoints]);

  const selected = useMemo(() => {
    if (!ownersByPoints.length) return null;
    const o = owner || ownersByPoints[0].owner;
    return ownersByPoints.find((s) => s.owner === o) ?? ownersByPoints[0];
  }, [ownersByPoints, owner]);

  if (!bundle || !displaySummary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Teams</h2>
        <p className="mt-1 text-sm text-slate-400">
          Roster by owner (owners sorted by season points high → low). Player rows
          sorted the same way.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Owner
        </span>
        <select
          value={selected?.owner ?? ""}
          onChange={(e) => {
            const o = e.target.value;
            setOwner(o);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("owner", o);
              return next;
            });
          }}
          className="max-w-md rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
        >
          {ownersByPoints.map((s) => (
            <option key={s.owner} value={s.owner}>
              {s.owner} ({s.totalPoints.toFixed(1)} pts)
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{selected.owner}</h3>
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
