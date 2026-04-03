import type { Franchise, LeagueBundle } from "../../types";
import { buildStandings, playerMapFromList } from "../buildStandings";

export function summarizeDisplayFranchises(
  bundle: LeagueBundle,
  franchises: Franchise[],
  pointCarryover: Record<string, number>,
) {
  const standings = buildStandings(franchises, bundle.players).map((s) => ({
    ...s,
    totalPoints: s.totalPoints + (pointCarryover[s.owner] ?? 0),
  }));
  const sorted = [...standings].sort((a, b) => b.totalPoints - a.totalPoints);
  const pmap = playerMapFromList(bundle.players);
  return { standings, sorted, pmap };
}
