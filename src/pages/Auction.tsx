import { useMemo } from "react";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useLeagueStandings } from "../context/WaiverContext";

export function Auction() {
  const { bundle } = useLeague();
  const summary = useLeagueStandings();

  const unsoldPlayers = useMemo(() => {
    if (!bundle || !summary) return [];
    const pmap = summary.pmap;
    return bundle.auction.unsoldPlayerIds
      .map((id) => pmap.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name));
  }, [bundle, summary]);

  const sales = useMemo(() => {
    if (!bundle || !summary) return [];
    const pmap = summary.pmap;
    return [...bundle.auction.sales].sort(
      (a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime(),
    ).map((s) => ({
      ...s,
      name: pmap.get(s.playerId)?.name ?? s.playerId,
    }));
  }, [bundle, summary]);

  if (!bundle) return null;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl tracking-wide text-white">Unsold pool</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          These player IDs are listed in{" "}
          <code className="app-code-inline">auction.json</code> under{" "}
          <code className="app-code-inline">unsoldPlayerIds</code>. After your group
          agrees on a winning bid, the commissioner updates{" "}
          <code className="app-code-inline">franchises.json</code>,{" "}
          <code className="app-code-inline">auction.json</code>, and pushes — everyone
          sees the change on refresh.
        </p>
        {unsoldPlayers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No unsold players right now.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {unsoldPlayers.map((p) => (
              <li
                key={p!.id}
                className="app-card flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{p!.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <IplTeamPill code={p!.iplTeam} />
                    <span>
                      {p!.role} · {p!.id}
                    </span>
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-cyan-400">
                  Open
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl tracking-wide text-white">Auction history</h2>
        {sales.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No completed sales recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {sales.map((s) => (
              <li
                key={`${s.playerId}-${s.soldAt}-${s.soldToOwner}`}
                className="app-card px-4 py-3 text-sm"
              >
                <p className="font-medium text-white">{s.name}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-400">
                  Sold to <OwnerBadge owner={s.soldToOwner} /> for{" "}
                  <span className="tabular-nums font-medium text-cyan-400">{s.amountCr} Cr</span>
                  <span className="text-slate-400"> · {s.soldAt}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
