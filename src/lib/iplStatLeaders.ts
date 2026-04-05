import type { Player, PlayerSeasonStats } from "../types";

function stats(p: Player): PlayerSeasonStats | undefined {
  return p.seasonStats;
}

export type StatLeader = { player: Player; display: string } | null;

function formatNum(n: number, decimals = 0): string {
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

/** Highest fantasy points (`seasonTotal`) in the league player pool. */
export function leaderMostFantasyPoints(players: Player[]): StatLeader {
  if (players.length === 0) return null;
  let best = players[0];
  let max = best.seasonTotal;
  for (const p of players) {
    if (p.seasonTotal > max) {
      max = p.seasonTotal;
      best = p;
    }
  }
  return { player: best, display: String(Math.round(max)) };
}

export function leaderTopRuns(players: Player[]): StatLeader {
  let best: Player | null = null;
  let max = -Infinity;
  for (const p of players) {
    const r = stats(p)?.runs;
    if (r == null || Number.isNaN(r)) continue;
    if (r > max) {
      max = r;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(max) };
}

export function leaderTopWickets(players: Player[]): StatLeader {
  let best: Player | null = null;
  let max = -Infinity;
  for (const p of players) {
    const w = stats(p)?.wickets;
    if (w == null || Number.isNaN(w)) continue;
    if (w > max) {
      max = w;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(max) };
}

/** Highest batting average among players with a defined average. */
export function leaderBestBattingAvg(players: Player[]): StatLeader {
  let best: Player | null = null;
  let max = -Infinity;
  for (const p of players) {
    const a = stats(p)?.battingAvg;
    if (a == null || Number.isNaN(a)) continue;
    if (a > max) {
      max = a;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(max, 2) };
}

/** Lowest bowling average (better = lower) among players with wickets recorded. */
export function leaderBestBowlingAvg(players: Player[]): StatLeader {
  let best: Player | null = null;
  let min = Infinity;
  for (const p of players) {
    const st = stats(p);
    if (st?.bowlingAvg == null || Number.isNaN(st.bowlingAvg)) continue;
    if ((st.wickets ?? 0) < 1) continue;
    if (st.bowlingAvg < min) {
      min = st.bowlingAvg;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(min, 2) };
}

export function leaderMostSixes(players: Player[]): StatLeader {
  let best: Player | null = null;
  let max = -Infinity;
  for (const p of players) {
    const x = stats(p)?.sixes;
    if (x == null || Number.isNaN(x)) continue;
    if (x > max) {
      max = x;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(max) };
}

export function leaderMostFours(players: Player[]): StatLeader {
  let best: Player | null = null;
  let max = -Infinity;
  for (const p of players) {
    const x = stats(p)?.fours;
    if (x == null || Number.isNaN(x)) continue;
    if (x > max) {
      max = x;
      best = p;
    }
  }
  if (!best) return null;
  return { player: best, display: formatNum(max) };
}
