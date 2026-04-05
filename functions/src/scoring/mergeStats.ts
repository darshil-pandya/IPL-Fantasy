import type { CbBatter, CbBowler } from "../scrape/cricbuzz.js";
import type { EspnBatterAgg, EspnBowlerAgg } from "../scrape/espn.js";
import type { PlayerMatchStat } from "./points.js";

/** e.g. 3.4 → 22 balls (3 overs + 4 balls). */
export function cricketOversToBalls(overs: number): number {
  const whole = Math.floor(overs + 1e-6);
  const rem = overs - whole;
  const tenths = Math.round(rem * 10 + 1e-6);
  if (tenths >= 0 && tenths <= 5) return whole * 6 + tenths;
  return Math.max(0, Math.round(overs * 6));
}

export function statFromCricbuzz(
  bat: CbBatter | undefined,
  bowl: CbBowler | undefined,
): PlayerMatchStat {
  const s: PlayerMatchStat = {};
  if (bat) {
    s.runsBat = bat.runs;
    s.ballsBat = bat.balls;
    s.fours = bat.fours;
    s.sixes = bat.sixes;
    s.dismissalText = bat.dismissal;
  }
  if (bowl) {
    s.ballsBowled = cricketOversToBalls(bowl.overs);
    s.maidens = bowl.maidens;
    s.conceded = bowl.conceded;
    s.wickets = bowl.wickets;
    s.dots = 0;
  }
  return s;
}

export function statFromEspn(
  bat: EspnBatterAgg | undefined,
  bowl: EspnBowlerAgg | undefined,
): PlayerMatchStat {
  const s: PlayerMatchStat = {};
  if (bat) {
    s.runsBat = bat.runs;
    s.ballsBat = bat.balls;
    s.fours = bat.fours;
    s.sixes = bat.sixes;
    s.isOut = bat.isOut;
    s.dismissalText = bat.dismissalText ?? "";
  }
  if (bowl) {
    s.ballsBowled = bowl.balls;
    s.maidens = bowl.maidens;
    s.conceded = bowl.conceded;
    s.wickets = bowl.wickets;
    s.dots = bowl.dots;
  }
  return s;
}

function close(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) <= eps;
}

export function rawStatsAgree(cb: PlayerMatchStat, es: PlayerMatchStat): boolean {
  const pairs: [number | undefined, number | undefined][] = [
    [cb.runsBat, es.runsBat],
    [cb.ballsBat, es.ballsBat],
    [cb.fours, es.fours],
    [cb.sixes, es.sixes],
    [cb.ballsBowled, es.ballsBowled],
    [cb.maidens, es.maidens],
    [cb.conceded, es.conceded],
    [cb.wickets, es.wickets],
  ];
  for (const [x, y] of pairs) {
    if (x == null && y == null) continue;
    if (x == null || y == null) return false;
    if (!close(x, y, x >= 20 ? 1.1 : 0.51)) return false;
  }
  return true;
}
