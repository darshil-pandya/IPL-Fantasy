import type { Franchise, LeagueBundle, Player } from "../../types";
import { buildStandings, playerMapFromList } from "../buildStandings";

/** Roster ids may reference players.json and/or waiver-pool-only rows after waivers. */
function playersForWaiverStandings(bundle: LeagueBundle): Player[] {
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const p of bundle.players) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  for (const p of bundle.waiverPool ?? []) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

export function summarizeDisplayFranchises(
  bundle: LeagueBundle,
  franchises: Franchise[],
  pointCarryover: Record<string, number>,
) {
  const rosterPlayers = playersForWaiverStandings(bundle);
  const standings = buildStandings(franchises, rosterPlayers).map((s) => ({
    ...s,
    totalPoints: s.totalPoints + (pointCarryover[s.owner] ?? 0),
  }));
  const sorted = [...standings].sort((a, b) => b.totalPoints - a.totalPoints);
  const pmap = playerMapFromList(rosterPlayers);
  return { standings, sorted, pmap };
}
