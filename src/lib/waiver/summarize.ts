import type { Franchise, LeagueBundle } from "../../types";
import {
  computeFranchiseScoring,
  type ClientOwnershipPeriod,
} from "../franchiseAttributedScoring";
import type { RosterChangeEvent } from "./types";

/** Roster ids may reference players.json and/or waiver-pool-only rows after waivers. */
export function summarizeDisplayFranchises(
  bundle: LeagueBundle,
  displayFranchises: Franchise[],
  rosterHistory: RosterChangeEvent[],
  currentRosters: Record<string, string[]>,
  /** When set and non-empty (e.g. from Firestore), scoring uses timestamp attribution. */
  ownershipPeriods?: ClientOwnershipPeriod[],
) {
  return computeFranchiseScoring(
    bundle,
    bundle.franchises,
    displayFranchises,
    currentRosters,
    rosterHistory,
    ownershipPeriods,
  );
}
