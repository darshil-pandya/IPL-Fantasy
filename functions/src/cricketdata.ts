/**
 * Temporary bridge: map Cricket Data / CricAPI-style fantasy summary JSON into
 * player id → points. Replace with your full rules engine when ready.
 */

export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function demoPlayerPointsFromFantasySummary(
  json: unknown,
  roster: { id: string; name: string }[],
): Record<string, number> {
  const nameToId = new Map(
    roster.map((p) => [normalizeName(p.name), p.id]),
  );
  const out: Record<string, number> = {};
  const root =
    json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const data = (root.data ?? root) as Record<string, unknown>;
  const batting = data.batting;
  if (!Array.isArray(batting)) return out;
  for (const row of batting) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name =
      typeof r.batsman === "string"
        ? r.batsman
        : typeof r.name === "string"
          ? r.name
          : null;
    const runs = Number(r.R ?? r.runs ?? 0);
    if (!name || !Number.isFinite(runs)) continue;
    const id = nameToId.get(normalizeName(name));
    if (id) out[id] = (out[id] ?? 0) + runs;
  }
  return out;
}
