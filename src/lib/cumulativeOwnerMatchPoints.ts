import type { FranchiseStanding } from "../types";
import { pointsInMatch, type MatchColumn } from "./matchColumns";

export type OwnerPointsChartRow = {
  step: number;
  /** Short X-axis tick (e.g. MM-DD or M1). */
  label: string;
  /** Full text for tooltips. */
  fullLabel: string;
} & Record<string, number | string>;

/**
 * Cumulative fantasy points per owner after each match column (current waiver squads).
 * Uses `byMatch` on each player; same columns as Match Center.
 */
export function buildOwnerCumulativeMatchChartData(
  standings: FranchiseStanding[],
  columns: MatchColumn[],
  ownerOrder: string[],
): { data: OwnerPointsChartRow[]; owners: string[] } {
  const ownersBase =
    ownerOrder.length > 0
      ? ownerOrder.filter((o) => standings.some((s) => s.owner === o))
      : standings.map((s) => s.owner);

  if (columns.length === 0) {
    return { data: [], owners: ownersBase };
  }

  const cumByOwner = new Map<string, number[]>();
  for (const s of standings) {
    let running = 0;
    const arr: number[] = [];
    for (const col of columns) {
      let round = 0;
      for (const p of s.playersResolved) {
        const v = pointsInMatch(p, col.id);
        if (v != null) round += v;
      }
      running += round;
      arr.push(Math.round(running * 100) / 100);
    }
    cumByOwner.set(s.owner, arr);
  }

  const owners = ownersBase;

  const data: OwnerPointsChartRow[] = [];
  const start: OwnerPointsChartRow = {
    step: 0,
    label: "—",
    fullLabel: "Before first match",
  };
  for (const o of owners) start[o] = 0;
  data.push(start);

  columns.forEach((col, i) => {
    const row: OwnerPointsChartRow = {
      step: i + 1,
      label:
        col.date.length >= 10
          ? `${col.date.slice(8, 10)}/${col.date.slice(5, 7)}`
          : `M${i + 1}`,
      fullLabel: `${col.date} — ${col.label}`,
    };
    for (const o of owners) {
      const series = cumByOwner.get(o);
      row[o] = series?.[i] ?? 0;
    }
    data.push(row);
  });

  return { data, owners };
}
