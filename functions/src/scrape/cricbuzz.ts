import * as cheerio from "cheerio";
import { fetchText } from "./http.js";
import { normalizePlayerName, queryTokens, scoreAgainstTokens } from "../util/names.js";

export type CricbuzzMatchPick = {
  id: string;
  slug: string;
  label: string;
  score: number;
};

const LIVE_URL = "https://www.cricbuzz.com/cricket-match/live-scores";

export async function discoverCricbuzzMatch(
  matchQuery: string,
): Promise<CricbuzzMatchPick | null> {
  const html = await fetchText(LIVE_URL);
  const tokens = queryTokens(matchQuery);
  const re = /href="\/live-cricket-scorecard\/(\d+)\/([^"]+)"/g;
  const seen = new Set<string>();
  const candidates: CricbuzzMatchPick[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    const slug = m[2];
    const key = `${id}-${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = slug.replace(/-/g, " ");
    const score = scoreAgainstTokens(tokens, `${label} ${slug}`);
    if (score < 4) continue;
    candidates.push({ id, slug, label, score });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

export type CbBatter = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
};

export type CbBowler = {
  overs: number;
  maidens: number;
  conceded: number;
  wickets: number;
};

function parseOversToken(t: string): number {
  if (/^\d+(\.\d)?$/.test(t) || /^\d+\.\d{1,2}$/.test(t)) {
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }
  return NaN;
}

/** Mobile scorecard HTML (richer than www shell). */
export function parseCricbuzzScorecardHtml(html: string): {
  batters: Map<string, CbBatter>;
  bowlers: Map<string, CbBowler>;
  title: string;
} {
  const $ = cheerio.load(html);
  const title = $("h1").first().text().trim() || "";
  const batters = new Map<string, CbBatter>();
  const bowlers = new Map<string, CbBowler>();

  $(".scorecard-bat-grid").each((_, el) => {
    const row = $(el);
    const headerish = row.find(".font-bold").first().text().trim();
    if (headerish === "Batter" || headerish.startsWith("Batter")) return;

    const link = row.find("a[href*='/profiles/']").first();
    const name = link.text().trim();
    if (!name) return;

    const nums: number[] = [];
    row.find("div.flex.justify-center.items-center").each((__, cell) => {
      const t = $(cell).text().trim();
      if (t === "" || t === "—") return;
      const n = parseFloat(t);
      if (Number.isFinite(n)) nums.push(n);
    });

    if (nums.length < 4) return;
    const [runs, balls, fours, sixes] = nums;
    const dismissal =
      row.find(".text-cbTxtSec").first().text().trim() ||
      row.find('[class*="text-cbTxtSec"]').first().text().trim();

    batters.set(normalizePlayerName(name), {
      runs,
      balls,
      fours,
      sixes,
      dismissal,
    });
  });

  $(".scorecard-bowl-grid").each((_, el) => {
    const row = $(el);
    const t0 = row.text();
    if (t0.includes("Bowler") && row.find("a[href*='/profiles/']").length === 0) return;

    const link = row.find("a[href*='/profiles/']").first();
    const name = link.text().trim();
    if (!name) return;

    const raw: string[] = [];
    row.children().each((__, ch) => {
      const $ch = $(ch);
      if ($ch.find("a[href*='/profiles/']").length) return;
      const t = $ch.text().trim();
      if (t) raw.push(t);
    });

    const nums: number[] = [];
    for (const t of raw) {
      const o = parseOversToken(t);
      if (!Number.isNaN(o)) nums.push(o);
    }
    if (nums.length < 4) return;
    const [overs, maidens, conceded, wickets] = nums;
    bowlers.set(normalizePlayerName(name), {
      overs,
      maidens,
      conceded,
      wickets,
    });
  });

  return { batters, bowlers, title };
}

export function cricbuzzScorecardUrl(id: string, slug: string): string {
  return `https://m.cricbuzz.com/live-cricket-scorecard/${id}/${slug}`;
}

export function scorecardLooksComplete(html: string): boolean {
  const h = html.toLowerCase();
  if (h.includes("match preview") || h.includes("upcoming")) return false;
  return (
    h.includes("won") ||
    h.includes("tied") ||
    h.includes("no result") ||
    h.includes("super over")
  );
}

export async function fetchCricbuzzScorecard(id: string, slug: string): Promise<string> {
  return fetchText(cricbuzzScorecardUrl(id, slug));
}
