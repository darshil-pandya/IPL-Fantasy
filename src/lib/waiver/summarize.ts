import type { Franchise, LeagueBundle } from "../../types";
import { computeFranchiseScoring } from "../franchiseAttributedScoring";
import type { RosterChangeEvent } from "./types";

/** Roster ids may reference players.json and/or waiver-pool-only rows after waivers. */
export function summarizeDisplayFranchises(
  bundle: LeagueBundle,
  displayFranchises: Franchise[],
  pointCarryover: Record<string, number>,
  rosterHistory: RosterChangeEvent[],
  currentRosters: Record<string, string[]>,
) {
  return computeFranchiseScoring(
    bundle,
    bundle.franchises,
    displayFranchises,
    currentRosters,
    rosterHistory,
    pointCarryover,
  );
}
