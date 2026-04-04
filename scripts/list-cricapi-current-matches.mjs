/**
 * Lists Cricket Data / CricAPI "current" matches so you can copy each match `id`
 * for Score sync → "Cricket Data match id".
 *
 * Usage:
 *   $env:CRICKETDATA_API_KEY = "your-key"
 *   node scripts/list-cricapi-current-matches.mjs [offset]
 *
 * Or (key stays out of shell history — prefer a path outside git):
 *   node scripts/list-cricapi-current-matches.mjs --key-file path/to/key.txt [offset]
 *
 * Optional: CRICKETDATA_API_BASE (default https://api.cricapi.com/v1)
 */

import fs from "fs";

const base = (process.env.CRICKETDATA_API_BASE || "https://api.cricapi.com/v1").replace(
  /\/$/,
  "",
);

const args = process.argv.slice(2);
let keyFile = null;
let offset = "0";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--key-file" && args[i + 1]) {
    keyFile = args[++i];
    continue;
  }
  if (/^\d+$/.test(args[i])) offset = args[i];
}

let key = process.env.CRICKETDATA_API_KEY?.trim() || "";
if (keyFile) {
  key = fs.readFileSync(keyFile, "utf8").trim();
}

if (!key) {
  console.error(
    "Provide CRICKETDATA_API_KEY or --key-file <path>. Never commit API keys into the repo.",
  );
  process.exit(1);
}

const url = `${base}/currentMatches?apikey=${encodeURIComponent(key)}&offset=${offset}`;

const res = await fetch(url);
const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error("Non-JSON response:", text.slice(0, 500));
  process.exit(1);
}

if (json?.status === "failure") {
  console.error("API:", json.reason ?? json.error ?? JSON.stringify(json));
  process.exit(1);
}

const raw = json?.data ?? json?.matches ?? json;
const list = Array.isArray(raw) ? raw : [];

if (list.length === 0) {
  console.log("No matches in this page. Raw keys:", Object.keys(json));
  console.log(JSON.stringify(json, null, 2).slice(0, 2000));
  process.exit(0);
}

console.log(`Found ${list.length} match(es) (offset=${offset}):\n`);
for (const m of list) {
  const id = m?.id ?? m?.matchId ?? m?.unique_id;
  const name = m?.name ?? m?.matchName ?? m?.teams?.join?.(" vs ");
  const status = m?.status ?? m?.matchStarted ?? "";
  console.log(`  id: ${id}\t${name ?? ""}\t${status}`);
}
