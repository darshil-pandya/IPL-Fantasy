export type WaiverPhase = "idle" | "nomination" | "bidding";

export interface WaiverNomination {
  id: string;
  roundId: number;
  nominatorOwner: string;
  playerInId: string;
  playerOutId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaiverBid {
  id: string;
  nominationId: string;
  bidderOwner: string;
  playerOutId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaiverLogEntry {
  at: string;
  kind: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface WaiverPersistentState {
  version: 1;
  roundId: number;
  phase: WaiverPhase;
  /** Full squad per owner (live roster). */
  rosters: Record<string, string[]>;
  budgets: Record<string, number>;
  pointCarryover: Record<string, number>;
  /** SeasonTotal snapshot when player last joined a franchise roster (for future refinement). */
  joinSnapshot: Record<string, number>;
  nominations: WaiverNomination[];
  bids: WaiverBid[];
  log: WaiverLogEntry[];
}

export type WaiverSession =
  | { role: "admin"; label: string }
  | { role: "owner"; label: string; owner: string };
