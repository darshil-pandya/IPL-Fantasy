export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*\(wk\)\s*/gi, " ")
    .replace(/\s*\(c\)\s*/gi, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/** Tokens from user query e.g. "CSK vs RR" */
export function queryTokens(query: string): Set<string> {
  const ABBR: Record<string, string[]> = {
    csk: ["chennai", "super", "kings", "csk"],
    mi: ["mumbai", "indians", "mi"],
    rcb: ["royal", "challengers", "bengaluru", "bangalore", "rcb"],
    kkr: ["kolkata", "knight", "riders", "kkr"],
    dc: ["delhi", "capitals", "dc"],
    srh: ["sunrisers", "hyderabad", "srh"],
    pbks: ["punjab", "kings", "pbks", "pk"],
    lsg: ["lucknow", "giants", "lsg"],
    rr: ["rajasthan", "royals", "rr"],
    gt: ["gujarat", "titans", "gt"],
  };
  const raw = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    for (const syn of ABBR[t] ?? []) out.add(syn);
  }
  return out;
}

export function scoreAgainstTokens(tokens: Set<string>, haystack: string): number {
  const h = haystack.toLowerCase();
  let sc = 0;
  for (const t of tokens) {
    if (t.length < 2) continue;
    if (h.includes(t)) sc += Math.min(t.length, 8);
  }
  return sc;
}
