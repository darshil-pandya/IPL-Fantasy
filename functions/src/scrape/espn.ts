import { fetchText } from "./http.js";
import { normalizePlayerName, queryTokens, scoreAgainstTokens } from "../util/names.js";

const LIVE_URL = "https://www.espncricinfo.com/live-cricket-score";

export type EspnMatchPick = {
  path: string;
  label: string;
  score: number;
  /** Calendar date of match start in Asia/Kolkata (YYYY-MM-DD). */
  matchDayYmd: string;
};

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

/** Match kickoff calendar day in India (YYYY-MM-DD). */
export function matchStartYmdIST(html: string): string | null {
  try {
    const j = extractNextDataJson(html);
    const m = j?.props?.appPageProps?.data?.match;
    const iso = m?.startTime ?? m?.startDate;
    if (iso == null) return null;
    const d = new Date(typeof iso === "number" ? iso : String(iso));
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  } catch {
    return null;
  }
}

export function espnScorecardLooksComplete(html: string): boolean {
  try {
    const j = extractNextDataJson(html);
    const m = j?.props?.appPageProps?.data?.match;
    if (!m) return false;
    if (m.state !== "POST") return false;
    const st = String(m.status ?? "").toUpperCase();
    if (st === "LIVE" || st === "UPCOMING" || st === "PREVIEW") return false;
    return true;
  } catch {
    return false;
  }
}

export function espnMatchStartIso(html: string): string | null {
  try {
    const j = extractNextDataJson(html);
    const m = j?.props?.appPageProps?.data?.match;
    const iso = m?.startTime ?? m?.startDate;
    if (iso == null) return null;
    const d = new Date(typeof iso === "number" ? iso : String(iso));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function collectIplScorecardPaths(html: string): string[] {
  const re = /href="(\/series\/ipl-[^"]+-match-\d+\/full-scorecard)"/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    seen.add(m[1]!);
  }
  return [...seen];
}

/**
 * From the live scores page, find an IPL scorecard whose slug matches the query and
 * whose match day (IST) equals matchDateYmd. Fetches each candidate scorecard until
 * dates align (only matches linked on the live page are discoverable).
 */
export async function discoverEspnMatch(
  matchQuery: string,
  matchDateYmd: string,
): Promise<EspnMatchPick | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDateYmd)) return null;

  const listingHtml = await fetchText(LIVE_URL);
  const paths = collectIplScorecardPaths(listingHtml);
  const tokens = queryTokens(matchQuery);

  type Scored = { path: string; label: string; score: number };
  const scored: Scored[] = [];
  for (const path of paths) {
    const label = path.split("/").slice(-2, -1)[0] ?? path;
    const s = scoreAgainstTokens(tokens, label.replace(/-/g, " "));
    if (s < 4) continue;
    scored.push({ path, label, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;

  const maxTry = Math.min(scored.length, 30);
  for (let i = 0; i < maxTry; i++) {
    const c = scored[i]!;
    try {
      const h = await fetchText(espnScorecardUrl(c.path));
      const ymd = matchStartYmdIST(h);
      if (!ymd || ymd !== matchDateYmd) continue;
      return {
        path: c.path,
        label: c.label,
        score: c.score,
        matchDayYmd: ymd,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function espnScorecardUrl(path: string): string {
  return `https://www.espncricinfo.com${path}`;
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

/** Title from ESPN JSON (e.g. team vs team). */
export function espnMatchTitleFromHtml(html: string): string {
  try {
    const j = extractNextDataJson(html);
    const t = j?.props?.appPageProps?.data?.match?.title;
    return typeof t === "string" ? t.trim() : "";
  } catch {
    return "";
  }
}
