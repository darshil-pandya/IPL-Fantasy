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
        <h2 className="text-xl font-bold text-brand-dark">Teams</h2>
        <p className="mt-1 text-sm text-slate-600">
          Roster by owner (owners sorted by season points high → low). Player rows
          sorted the same way.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-brand-dark/90">
        <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/50">
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
          className="app-input max-w-md py-2.5"
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
            <h3 className="text-lg font-semibold text-brand-dark">{selected.owner}</h3>
            <OwnerBadge owner={selected.owner} />
            <span className="text-sm text-slate-500">
              {selected.totalPoints.toFixed(1)} season pts
            </span>
            <Link
              to={`/teams/${ownerSlug(selected.owner)}`}
              className="ml-auto text-sm font-medium text-brand-ocean hover:text-brand-dark"
            >
              Open squad details (match breakdown) →
            </Link>
          </div>

          <div className="app-table">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="app-table-head">
                <tr>
                  <th className="px-3 py-3 font-medium">Player</th>
                  <th className="px-3 py-3 font-medium">IPL team</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Nationality</th>
                  <th className="px-3 py-3 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {[...selected.playersResolved]
                  .sort((a, b) => b.seasonTotal - a.seasonTotal)
                  .map((p) => (
                    <tr key={p.id} className="app-table-row">
                      <td className="px-3 py-3 font-medium text-brand-dark">{p.name}</td>
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
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-ocean">
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
