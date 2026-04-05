import { fetchText } from "./http.js";
import { normalizePlayerName, queryTokens, scoreAgainstTokens } from "../util/names.js";

const LIVE_URL = "https://www.espncricinfo.com/live-cricket-score";

export type EspnMatchPick = {
  path: string;
  label: string;
  score: number;
};

export async function discoverEspnMatch(matchQuery: string): Promise<EspnMatchPick | null> {
  const html = await fetchText(LIVE_URL);
  const tokens = queryTokens(matchQuery);
  const re =
    /href="(\/series\/ipl-[^"]+-match-\d+\/full-scorecard)"/gi;
  const seen = new Set<string>();
  const candidates: EspnMatchPick[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const path = m[1];
    if (seen.has(path)) continue;
    seen.add(path);
    const label = path.split("/").slice(-2, -1)[0] ?? path;
    const score = scoreAgainstTokens(tokens, label.replace(/-/g, " "));
    if (score < 4) continue;
    candidates.push({ path, label, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

export function espnScorecardUrl(path: string): string {
  return `https://www.espncricinfo.com${path}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractNextDataJson(html: string): any {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const si = html.indexOf(marker);
  if (si < 0) throw new Error("ESPN page missing __NEXT_DATA__");
  const start = si + marker.length;
  const end = html.indexOf("</script>", start);
  if (end < 0) throw new Error("ESPN __NEXT_DATA__ truncated");
  return JSON.parse(html.slice(start, end));
}

export type EspnBatterAgg = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: string;
  dismissalText?: string;
};

export type EspnBowlerAgg = {
  balls: number;
  maidens: number;
  conceded: number;
  wickets: number;
  dots: number;
};

export type EspnParsed = {
  batters: Map<string, EspnBatterAgg>;
  bowlers: Map<string, EspnBowlerAgg>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeBat(m: Map<string, EspnBatterAgg>, row: any): void {
  const name = row?.player?.name as string | undefined;
  if (!name) return;
  const key = normalizePlayerName(name);
  const cur = m.get(key);
  const next: EspnBatterAgg = {
    runs: (cur?.runs ?? 0) + Number(row.runs ?? 0),
    balls: (cur?.balls ?? 0) + Number(row.balls ?? 0),
    fours: (cur?.fours ?? 0) + Number(row.fours ?? 0),
    sixes: (cur?.sixes ?? 0) + Number(row.sixes ?? 0),
    isOut: Boolean(row.isOut) || cur?.isOut === true,
    dismissalType: row.dismissalType ?? cur?.dismissalType,
    dismissalText: row.dismissalText ?? cur?.dismissalText,
  };
  m.set(key, next);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeBowl(m: Map<string, EspnBowlerAgg>, row: any): void {
  const name = row?.player?.name as string | undefined;
  if (!name) return;
  const key = normalizePlayerName(name);
  const cur = m.get(key);
  const ballsBowled = Number(row.balls ?? Math.round(Number(row.overs ?? 0) * 6));
  const next: EspnBowlerAgg = {
    balls: (cur?.balls ?? 0) + ballsBowled,
    maidens: (cur?.maidens ?? 0) + Number(row.maidens ?? 0),
    conceded: (cur?.conceded ?? 0) + Number(row.conceded ?? 0),
    wickets: (cur?.wickets ?? 0) + Number(row.wickets ?? 0),
    dots: (cur?.dots ?? 0) + Number(row.dots ?? 0),
  };
  m.set(key, next);
}

export function parseEspnScorecardHtml(html: string): EspnParsed {
  const j = extractNextDataJson(html);
  const innings = j?.props?.appPageProps?.data?.content?.innings;
  if (!Array.isArray(innings)) throw new Error("ESPN innings missing");

  const batters = new Map<string, EspnBatterAgg>();
  const bowlers = new Map<string, EspnBowlerAgg>();

  for (const inn of innings) {
    for (const row of inn.inningBatsmen ?? []) mergeBat(batters, row);
    for (const row of inn.inningBowlers ?? []) mergeBowl(bowlers, row);
  }

  return { batters, bowlers };
}

export async function fetchEspnScorecard(path: string): Promise<string> {
  return fetchText(espnScorecardUrl(path));
}
