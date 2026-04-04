/**
 * Fetches all pages of CricAPI currentMatches and prints a Markdown table.
 *
 *   $env:CRICKETDATA_API_KEY = "…"
 *   node scripts/cricapi-current-matches-report.mjs
 *
 *   node scripts/cricapi-current-matches-report.mjs --key-file C:\secrets\cricapi.txt
 *
 *   node scripts/cricapi-current-matches-report.mjs --json   # full JSON per match after table
 */

import fs from "fs";

const base = (process.env.CRICKETDATA_API_BASE || "https://api.cricapi.com/v1").replace(
  /\/$/,
  "",
);

const args = process.argv.slice(2);
let keyFile = null;
let wantJson = args.includes("--json");
const filtered = args.filter((a) => a !== "--json");
for (let i = 0; i < filtered.length; i++) {
  if (filtered[i] === "--key-file" && filtered[i + 1]) {
    keyFile = filtered[++i];
  }
}

let key = process.env.CRICKETDATA_API_KEY?.trim() || "";
if (keyFile) key = fs.readFileSync(keyFile, "utf8").trim();

if (!key) {
  console.error(
    "Set CRICKETDATA_API_KEY or pass --key-file <path>. Never commit your API key.",
  );
  process.exit(1);
}

function pick(m) {
  const teams = m?.teamInfo
    ? Object.values(m.teamInfo)
        .map((t) => t?.name)
        .filter(Boolean)
        .join(" vs ")
    : Array.isArray(m?.teams)
      ? m.teams.join(" vs ")
      : "";
  return {
    id: m?.id ?? m?.matchId ?? m?.unique_id ?? "",
    name: m?.name ?? m?.matchName ?? "",
    status: m?.status != null ? String(m.status) : "",
    matchType: m?.matchType ?? m?.type ?? "",
    venue: m?.venue ?? "",
    date: m?.date ?? "",
    dateTimeGMT: m?.dateTimeGMT ?? m?.dateTimeGmt ?? "",
    teams: teams || "—",
  };
}

const all = [];
let offset = 0;
const pageSize = 25;

for (;;) {
  const url = `${base}/currentMatches?apikey=${encodeURIComponent(key)}&offset=${offset}`;
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Non-JSON:", text.slice(0, 400));
    process.exit(1);
  }
  if (json?.status === "failure") {
    console.error("API:", json.reason ?? json.error);
    process.exit(1);
  }
  const raw = json?.data ?? json?.matches ?? json;
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) break;
  all.push(...list);
  if (list.length < pageSize) break;
  offset += pageSize;
}

if (all.length === 0) {
  console.log("No matches returned.");
  process.exit(0);
}

function esc(s) {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

console.log(`_Total: ${all.length} matches (as of API response)._`);
console.log("");
console.log(
  "| # | Match id | Name | Status | Type | Venue | Date | DateTime GMT | Teams |",
);
console.log("| ---: | --- | --- | --- | --- | --- | --- | --- | --- |");

all.forEach((m, i) => {
  const p = pick(m);
  console.log(
    `| ${i + 1} | \`${esc(p.id)}\` | ${esc(p.name)} | ${esc(p.status)} | ${esc(p.matchType)} | ${esc(p.venue)} | ${esc(p.date)} | ${esc(p.dateTimeGMT)} | ${esc(p.teams)} |`,
  );
});

if (wantJson) {
  console.log("");
  console.log("## Full JSON (per match)");
  all.forEach((m, i) => {
    console.log("");
    console.log(`### ${i + 1}. ${pick(m).id}`);
    console.log("```json");
    console.log(JSON.stringify(m, null, 2));
    console.log("```");
  });
}
