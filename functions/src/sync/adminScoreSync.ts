import { getFirestore } from "firebase-admin/firestore";
import {
  discoverCricbuzzMatch,
  fetchCricbuzzScorecard,
  parseCricbuzzScorecardHtml,
  scorecardLooksComplete,
} from "../scrape/cricbuzz.js";
import {
  discoverEspnMatch,
  fetchEspnScorecard,
  parseEspnScorecardHtml,
  type EspnBatterAgg,
} from "../scrape/espn.js";
import { normalizePlayerName } from "../util/names.js";
import { fantasyPointsForPlayer, type Role } from "../scoring/points.js";
import { rawStatsAgree, statFromCricbuzz, statFromEspn } from "../scoring/mergeStats.js";

export type LeaguePlayerRow = {
  id: string;
  name: string;
  role: Role;
};

export type AdminSyncResult = {
  ok: boolean;
  matchLabel: string;
  matchKey: string;
  matchDate: string;
  cricbuzzUrl: string;
  espnUrl: string;
  cricbuzzComplete: boolean;
  validated: boolean;
  playerPoints: Record<string, number>;
  /** Stat / points mismatches or missing player in one source — blocks Firestore write. */
  inconsistencies: string[];
  /** Non-fatal notices (duplicate names, incomplete-looking page, etc.). */
  warnings: string[];
  wroteFirestore: boolean;
  note?: string;
};

function dismissalRowsFromEspn(batters: Map<string, EspnBatterAgg>): { dismissal: string }[] {
  const out: { dismissal: string }[] = [];
  for (const b of batters.values()) {
    const t = b.dismissalText ?? "";
    if (t.trim()) out.push({ dismissal: t });
  }
  return out;
}

function dismissalRowsFromCb(
  batters: Map<string, import("../scrape/cricbuzz.js").CbBatter>,
): { dismissal: string }[] {
  const out: { dismissal: string }[] = [];
  for (const b of batters.values()) {
    if (b.dismissal.trim()) out.push({ dismissal: b.dismissal });
  }
  return out;
}

function buildNameToIds(players: LeaguePlayerRow[]): {
  map: Map<string, string[]>;
  dupes: string[];
} {
  const map = new Map<string, string[]>();
  for (const p of players) {
    const k = normalizePlayerName(p.name);
    const arr = map.get(k) ?? [];
    arr.push(p.id);
    map.set(k, arr);
  }
  const dupes: string[] = [];
  for (const [k, ids] of map) {
    if (ids.length > 1) dupes.push(`${k} → ${ids.join(", ")}`);
  }
  return { map, dupes };
}

function stableMatchKey(cricbuzzId: string, espnPath: string): string {
  const slug = espnPath.replace(/\//g, "_").replace(/^series_/, "");
  return `m_${cricbuzzId}_${slug}`;
}

export async function runAdminScoreSync(opts: {
  matchQuery: string;
  writeToFirestore: boolean;
}): Promise<AdminSyncResult> {
  const inconsistencies: string[] = [];
  const warnings: string[] = [];
  const matchQuery = opts.matchQuery.trim();

  const cbPick = await discoverCricbuzzMatch(matchQuery);
  if (!cbPick) {
    return {
      ok: false,
      matchLabel: matchQuery,
      matchKey: "",
      matchDate: new Date().toISOString(),
      cricbuzzUrl: "",
      espnUrl: "",
      cricbuzzComplete: false,
      validated: false,
      playerPoints: {},
      inconsistencies: ["Cricbuzz: no IPL scorecard link matched this query on live scores."],
      warnings: [],
      wroteFirestore: false,
    };
  }

  const esPick = await discoverEspnMatch(matchQuery);
  if (!esPick) {
    return {
      ok: false,
      matchLabel: cbPick.label,
      matchKey: "",
      matchDate: new Date().toISOString(),
      cricbuzzUrl: `https://m.cricbuzz.com/live-cricket-scorecard/${cbPick.id}/${cbPick.slug}`,
      espnUrl: "",
      cricbuzzComplete: false,
      validated: false,
      playerPoints: {},
      inconsistencies: ["ESPNcricinfo: no IPL full-scorecard link matched this query."],
      warnings: [],
      wroteFirestore: false,
    };
  }

  const cricbuzzUrl = `https://m.cricbuzz.com/live-cricket-scorecard/${cbPick.id}/${cbPick.slug}`;
  const espnUrl = `https://www.espncricinfo.com${esPick.path}`;

  const [cbHtml, esHtml] = await Promise.all([
    fetchCricbuzzScorecard(cbPick.id, cbPick.slug),
    fetchEspnScorecard(esPick.path),
  ]);

  const cricbuzzComplete = scorecardLooksComplete(cbHtml);
  if (!cricbuzzComplete) {
    warnings.push(
      "Cricbuzz page does not look finished (no result keywords). Confirm the match has ended; Firestore write is disabled until it looks complete.",
    );
  }

  const cbParsed = parseCricbuzzScorecardHtml(cbHtml);
  const esParsed = parseEspnScorecardHtml(esHtml);

  const dismissCb = dismissalRowsFromCb(cbParsed.batters);
  const dismissEs = dismissalRowsFromEspn(esParsed.batters);

  const db = getFirestore();
  const leagueSnap = await db.doc("iplFantasy/leagueBundle").get();
  const payload = leagueSnap.data()?.payload as
    | { players?: LeaguePlayerRow[]; waiverPool?: LeaguePlayerRow[] }
    | undefined;

  const rows: LeaguePlayerRow[] = [];
  const seenId = new Set<string>();
  function pushRow(p: { id?: string; name?: string; role?: string }): void {
    if (!p?.id || !p?.name || !p?.role) return;
    if (seenId.has(p.id)) return;
    const role = p.role;
    if (role !== "BAT" && role !== "BOWL" && role !== "AR" && role !== "WK") return;
    seenId.add(p.id);
    rows.push({ id: p.id, name: p.name, role });
  }
  if (payload?.players) {
    for (const p of payload.players) pushRow(p);
  }
  if (payload?.waiverPool) {
    for (const p of payload.waiverPool) pushRow(p);
  }

  if (rows.length === 0) {
    inconsistencies.push(
      "Firestore iplFantasy/leagueBundle has no players — cannot map scorecard names to ids.",
    );
  }

  const { map: nameToIds, dupes } = buildNameToIds(rows);
  for (const d of dupes) {
    warnings.push(`Duplicate normalized name in roster (skipped auto-map): ${d}`);
  }

  const keys = new Set<string>();
  for (const k of cbParsed.batters.keys()) keys.add(k);
  for (const k of cbParsed.bowlers.keys()) keys.add(k);
  for (const k of esParsed.batters.keys()) keys.add(k);
  for (const k of esParsed.bowlers.keys()) keys.add(k);

  const playerPoints: Record<string, number> = {};
  let validated = true;

  for (const norm of keys) {
    const ids = nameToIds.get(norm);
    if (!ids?.length || ids.length > 1) continue;

    const id = ids[0]!;
    const leagueRow = rows.find((r) => r.id === id);
    if (!leagueRow) continue;

    const cbBat = cbParsed.batters.get(norm);
    const cbBowl = cbParsed.bowlers.get(norm);
    const esBat = esParsed.batters.get(norm);
    const esBowl = esParsed.bowlers.get(norm);

    if (!cbBat && !cbBowl && !esBat && !esBowl) continue;

    const hasCb = Boolean(cbBat || cbBowl);
    const hasEs = Boolean(esBat || esBowl);
    if (hasCb !== hasEs) {
      validated = false;
      inconsistencies.push(
        `${leagueRow.name}: appears in only one of the two scorecards (Cricbuzz vs ESPN).`,
      );
      continue;
    }

    const stCb = statFromCricbuzz(cbBat, cbBowl);
    const stEs = statFromEspn(esBat, esBowl);

    if (!rawStatsAgree(stCb, stEs)) {
      validated = false;
      inconsistencies.push(
        `Stats differ for ${leagueRow.name}: Cricbuzz vs ESPN (runs ${stCb.runsBat ?? "—"} vs ${stEs.runsBat ?? "—"}, wkts ${stCb.wickets ?? "—"} vs ${stEs.wickets ?? "—"}, etc.).`,
      );
    }

    const ptsCb = fantasyPointsForPlayer(leagueRow.role, stCb, {
      allDismissals: dismissCb,
      playerNorm: norm,
    });
    const ptsEs = fantasyPointsForPlayer(leagueRow.role, stEs, {
      allDismissals: dismissEs,
      playerNorm: norm,
    });

    if (Math.abs(ptsCb - ptsEs) > 0.75) {
      validated = false;
      inconsistencies.push(
        `Points differ for ${leagueRow.name}: Cricbuzz-derived ${ptsCb.toFixed(2)} vs ESPN-derived ${ptsEs.toFixed(2)}.`,
      );
    }

    playerPoints[id] = Math.round(((ptsCb + ptsEs) / 2) * 100) / 100;
  }

  const matchKey = stableMatchKey(cbPick.id, esPick.path);
  const matchLabel = cbParsed.title || cbPick.label;
  const matchDate = new Date().toISOString();

  const scoredIds = Object.keys(playerPoints).length;
  if (rows.length > 0 && scoredIds === 0) {
    validated = false;
    inconsistencies.push(
      "No league roster players matched scorecard names — check display names vs Cricbuzz/ESPN.",
    );
  }

  let wroteFirestore = false;
  const canWrite =
    opts.writeToFirestore &&
    validated &&
    inconsistencies.length === 0 &&
    cricbuzzComplete &&
    rows.length > 0 &&
    scoredIds > 0;

  if (canWrite) {
    const ref = db.doc("iplFantasy/fantasyMatchScores");
    await ref.set(
      {
        matches: {
          [matchKey]: {
            matchKey,
            matchLabel,
            matchDate,
            status: "final",
            playerPoints,
          },
        },
      },
      { merge: true },
    );
    wroteFirestore = true;
  } else if (opts.writeToFirestore) {
    warnings.push(
      "Firestore write skipped: resolve blocking inconsistencies, ensure the Cricbuzz page looks complete, and that leagueBundle has players.",
    );
  }

  const note =
    "Automated sync excludes fielding, named-in-XI, and impact-player points; add those manually if needed.";

  return {
    ok: true,
    matchLabel,
    matchKey,
    matchDate,
    cricbuzzUrl,
    espnUrl,
    cricbuzzComplete,
    validated,
    playerPoints,
    inconsistencies,
    warnings,
    wroteFirestore,
    note,
  };
}
