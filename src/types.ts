export type PlayerRole = "BAT" | "BOWL" | "AR" | "WK";

export interface MatchPoints {
  matchLabel: string;
  matchDate: string;
  points: number;
}

export type PlayerNationality = "IND" | "OVS";

export interface Player {
  id: string;
  name: string;
  iplTeam: string;
  role: PlayerRole;
  /** Indian vs overseas (optional; used for roster badges). */
  nationality?: PlayerNationality;
  seasonTotal: number;
  byMatch: MatchPoints[];
}

export interface Franchise {
  owner: string;
  teamName: string;
  playerIds: string[];
}

export interface AuctionSale {
  playerId: string;
  soldToOwner: string;
  amountCr: number;
  soldAt: string;
}

export interface AuctionState {
  unsoldPlayerIds: string[];
  sales: AuctionSale[];
}

export interface RulesTeamComposition {
  title: string;
  bullets: string[];
}

export interface RulesScoringRow {
  action: string;
  points: string;
}

export interface RulesScoringSection {
  heading: string;
  rows: RulesScoringRow[];
}

export interface RulesScoring {
  title: string;
  sections: RulesScoringSection[];
  footer: string;
}

export interface LeagueRules {
  teamComposition: RulesTeamComposition;
  scoring: RulesScoring;
}

export interface LeagueMeta {
  seasonLabel: string;
  lastPointsUpdate: string | null;
  pointsUpdateNote: string;
  cricbuzzBaseUrl: string;
}

export interface FranchiseStanding extends Franchise {
  totalPoints: number;
  playersResolved: Player[];
  missingPlayerIds: string[];
}

export interface LeagueBundle {
  meta: LeagueMeta;
  franchises: Franchise[];
  players: Player[];
  auction: AuctionState;
  rules: LeagueRules;
}
