import type { MatchPoints, Player } from "../types";

const SEP = "\u001f";

export function matchColumnId(m: Pick<MatchPoints, "matchDate" | "matchLabel">): string {
  return `${m.matchDate}${SEP}${m.matchLabel}`;
}

export function parseMatchColumnId(id: string): { date: string; label: string } {
  const i = id.indexOf(SEP);
  if (i === -1) return { date: id, label: "" };
  return { date: id.slice(0, i), label: id.slice(i + SEP.length) };
}

export interface MatchColumn {
  id: string;
  date: string;
  label: string;
}

export function matchColumnsFromPlayers(players: Player[]): MatchColumn[] {
  const map = new Map<string, MatchColumn>();
  for (const p of players) {
    for (const m of p.byMatch) {
      const id = matchColumnId(m);
      if (!map.has(id)) {
        map.set(id, { id, date: m.matchDate, label: m.matchLabel });
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label),
  );
}

export function pointsInMatch(p: Player, columnId: string): number | null {
  const { date, label } = parseMatchColumnId(columnId);
  const row = p.byMatch.find((x) => x.matchDate === date && x.matchLabel === label);
  return row ? row.points : null;
}
