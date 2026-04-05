/** IPL 2026 fantasy — automated subset (see rules.json). Fielding / some edge cases need manual review. */

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export type PlayerMatchStat = {
  runsBat?: number;
  ballsBat?: number;
  fours?: number;
  sixes?: number;
  isOut?: boolean;
  dismissalText?: string;
  ballsBowled?: number;
  maidens?: number;
  conceded?: number;
  wickets?: number;
  dots?: number;
};

/** 25/50/75/100 bonuses; century uses only the +16 tier (rules.json). */
function milestonePoints(runs: number): number {
  if (runs >= 100) return 16;
  if (runs >= 75) return 12;
  if (runs >= 50) return 8;
  if (runs >= 25) return 4;
  return 0;
}

function strikeRatePoints(sr: number): number {
  if (sr > 170) return 6;
  if (sr > 150) return 4;
  if (sr >= 130) return 2;
  if (sr <= 70 && sr >= 60) return -2;
  if (sr < 60 && sr >= 50) return -4;
  if (sr < 50) return -6;
  return 0;
}

function economyPoints(eco: number, ballsBowled: number): number {
  if (ballsBowled < 12) return 0;
  if (eco < 5) return 6;
  if (eco < 6) return 4;
  if (eco < 7) return 2;
  if (eco >= 7 && eco < 10) return 0;
  if (eco <= 11) return -2;
  if (eco <= 12) return -4;
  return -6;
}

function haulPoints(wickets: number): number {
  let p = 0;
  if (wickets >= 5) p += 16;
  else if (wickets === 4) p += 8;
  else if (wickets === 3) p += 4;
  return p;
}

function isDuckEligible(role: Role): boolean {
  return role === "BAT" || role === "WK" || role === "AR";
}

/**
 * +8 per wicket taken via LBW or bowled (parsed from batter dismissal text).
 */
function lbwBowledBonusForBowler(
  allBatters: { dismissal: string }[],
  bowlerNorm: string,
): number {
  const bn = bowlerNorm.toLowerCase();
  let n = 0;
  for (const { dismissal } of allBatters) {
    const d = dismissal.toLowerCase();
    if (!d.includes("lbw") && !d.includes("bowled")) continue;
    if (d.includes("run out")) continue;
    const m = d.match(/\bb\s+([^,]+)/);
    const bowlerPart = (m?.[1] ?? "").toLowerCase();
    if (bowlerPart.includes(bn) || bn.includes(bowlerPart.trim())) n += 1;
  }
  return n * 8;
}

function batterIsOut(s: PlayerMatchStat): boolean {
  if (s.isOut === true) return true;
  if (s.isOut === false) return false;
  const d = (s.dismissalText ?? "").toLowerCase();
  if (!d.trim()) return false;
  if (d.includes("not out")) return false;
  if (d.includes("did not bat") || d.includes("dnb")) return false;
  return true;
}

export function fantasyPointsForPlayer(
  role: Role,
  s: PlayerMatchStat,
  ctx?: { allDismissals?: { dismissal: string }[]; playerNorm: string },
): number {
  let pts = 0;
  const runs = s.runsBat ?? 0;
  const balls = s.ballsBat ?? 0;
  const fours = s.fours ?? 0;
  const sixes = s.sixes ?? 0;

  if (balls > 0 || runs > 0) {
    pts += runs;
    pts += fours * 2;
    pts += sixes * 4;
    pts += milestonePoints(runs);
    if (runs === 0 && balls > 0 && isDuckEligible(role) && batterIsOut(s)) {
      pts -= 2;
    }
  }

  if (role !== "BOWL" && balls >= 10) {
    const sr = (runs / balls) * 100;
    pts += strikeRatePoints(sr);
  }

  const bb = s.ballsBowled ?? 0;
  const wk = s.wickets ?? 0;
  const conc = s.conceded ?? 0;
  const dots = s.dots ?? 0;
  const maid = s.maidens ?? 0;

  if (bb > 0 || wk > 0) {
    pts += wk * 25;
    pts += maid * 12;
    pts += dots;
    pts += haulPoints(wk);
    const overs = bb / 6;
    const eco = overs > 0 ? conc / overs : 0;
    pts += economyPoints(eco, bb);
    if (ctx?.allDismissals) {
      pts += lbwBowledBonusForBowler(ctx.allDismissals, ctx.playerNorm);
    }
  }

  return Math.round(pts * 100) / 100;
}
