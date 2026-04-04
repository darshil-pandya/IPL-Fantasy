import type { FantasyMatchOverlayEntry, LeagueBundle, Player } from "../../types";

function applyOverlaysToPlayer(
  p: Player,
  overlays: FantasyMatchOverlayEntry[],
): Player {
  let byMatch = p.byMatch.map((m) => ({ ...m }));
  for (const o of overlays) {
    if (o.status === "abandoned") {
      byMatch = byMatch.filter(
        (m) => (m.matchKey ?? m.matchLabel) !== o.matchKey,
      );
      continue;
    }
    const pts = o.playerPoints[p.id];
    if (pts === undefined) continue;
    byMatch = byMatch.filter(
      (m) => (m.matchKey ?? m.matchLabel) !== o.matchKey,
    );
    byMatch.push({
      matchLabel: o.matchLabel,
      matchDate: o.matchDate,
      points: pts,
      matchKey: o.matchKey,
    });
  }
  byMatch.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const seasonTotal = byMatch.reduce((s, m) => s + m.points, 0);
  return { ...p, byMatch, seasonTotal };
}

function applyToPlayers(
  players: Player[],
  overlays: FantasyMatchOverlayEntry[],
): Player[] {
  if (overlays.length === 0) return players;
  return players.map((p) => applyOverlaysToPlayer(p, overlays));
}

/** Merges Firestore fantasy overlays into roster + waiver pool players (immutable). */
export function mergeBundleWithFantasyOverlays(
  base: LeagueBundle,
  overlays: FantasyMatchOverlayEntry[],
): LeagueBundle {
  if (overlays.length === 0) return base;
  return {
    ...base,
    players: applyToPlayers(base.players, overlays),
    waiverPool: base.waiverPool
      ? applyToPlayers(base.waiverPool, overlays)
      : undefined,
  };
}
