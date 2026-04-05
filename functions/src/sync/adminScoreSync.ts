import { getFirestore } from "firebase-admin/firestore";
import {
  discoverEspnMatch,
  espnDismissalAsString,
  espnMatchStartIso,
  espnMatchTitleFromHtml,
  espnScorecardLooksComplete,
  fetchEspnScorecard,
  parseEspnScorecardHtml,
  type EspnBatterAgg,
} from "../scrape/espn.js";
import { normalizePlayerName } from "../util/names.js";
import { fantasyPointsForPlayer, type Role } from "../scoring/points.js";
import { statFromEspn } from "../scoring/mergeStats.js";

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
  scorecardUrl: string;
  source: "espncricinfo";
  scorecardComplete: boolean;
  validated: boolean;
  playerPoints: Record<string, number>;
  inconsistencies: string[];
  warnings: string[];
  wroteFirestore: boolean;
  note?: string;
};

function dismissalRowsFromEspn(batters: Map<string, EspnBatterAgg>): { dismissal: string }[] {
  const out: { dismissal: string }[] = [];
  for (const b of batters.values()) {
    const t = espnDismissalAsString(b.dismissalText);
    if (t.trim()) out.push({ dismissal: t });
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

function stableMatchKey(path: string): string {
  return `espn_${path.replace(/\//g, "_").replace(/^\/+/, "")}`;
}

export async function runAdminScoreSync(opts: {
  matchQuery: string;
  matchDateYmd: string;
  writeToFirestore: boolean;
}): Promise<AdminSyncResult> {
  const inconsistencies: string[] = [];
  const warnings: string[] = [];
  const matchQuery = opts.matchQuery.trim();
  const matchDateYmd = opts.matchDateYmd.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDateYmd)) {
    return {
      ok: false,
      matchLabel: matchQuery,
      matchKey: "",
      matchDate: "",
      scorecardUrl: "",
      source: "espncricinfo",
      scorecardComplete: false,
      validated: false,
      playerPoints: {},
      inconsistencies: ["Invalid matchDate (use YYYY-MM-DD)."],
      warnings: [],
      wroteFirestore: false,
    };
  }

  const esPick = await discoverEspnMatch(matchQuery, matchDateYmd);
  if (!esPick) {
    return {
      ok: false,
      matchLabel: matchQuery,
      matchKey: "",
      matchDate: `${matchDateYmd}T00:00:00.000Z`,
      scorecardUrl: "",
      source: "espncricinfo",
      scorecardComplete: false,
      validated: false,
      playerPoints: {},
      inconsistencies: [
        "ESPNcricinfo: no IPL 2026 fixture matched this query and date. Check the match date (IST), team abbreviations (e.g. CSK vs RR), and that the season fixtures URL in the Cloud Function still matches ESPN.",
      ],
      warnings: [],
      wroteFirestore: false,
    };
  }

  const scorecardUrl = `https://www.espncricinfo.com${esPick.path}`;
  const esHtml = await fetchEspnScorecard(esPick.path);

  const scorecardComplete = espnScorecardLooksComplete(esHtml);
  if (!scorecardComplete) {
    warnings.push(
      "This match does not look finished on ESPN (state/status). Firestore write is disabled until the match is complete.",
    );
  }

  const esParsed = parseEspnScorecardHtml(esHtml);
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

    const esBat = esParsed.batters.get(norm);
    const esBowl = esParsed.bowlers.get(norm);

    if (!esBat && !esBowl) continue;

    const stEs = statFromEspn(esBat, esBowl);

    const pts = fantasyPointsForPlayer(leagueRow.role, stEs, {
      allDismissals: dismissEs,
      playerNorm: norm,
    });

    playerPoints[id] = Math.round(pts * 100) / 100;
  }

  const matchKey = stableMatchKey(esPick.path);
  const title = espnMatchTitleFromHtml(esHtml);
  const matchLabel = title || esPick.label.replace(/-/g, " ");
  const matchDate = espnMatchStartIso(esHtml) ?? `${matchDateYmd}T12:00:00.000Z`;

  const scoredIds = Object.keys(playerPoints).length;
  if (rows.length > 0 && scoredIds === 0) {
    validated = false;
    inconsistencies.push(
      "No league roster players matched the ESPN scorecard — check display names vs ESPN.",
    );
  }

  let wroteFirestore = false;
  const canWrite =
    opts.writeToFirestore &&
    validated &&
    inconsistencies.length === 0 &&
    scorecardComplete &&
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
      "Firestore write skipped: resolve blocking issues, ensure the match is complete on ESPN, and that leagueBundle has players.",
    );
  }

  const note =
    "Points are derived from ESPNcricinfo scorecards only. Fielding, named-in-XI, and impact-player points are not automated.";

  return {
    ok: true,
    matchLabel,
    matchKey,
    matchDate,
    scorecardUrl,
    source: "espncricinfo",
    scorecardComplete,
    validated,
    playerPoints,
    inconsistencies,
    warnings,
    wroteFirestore,
    note,
  };
}
