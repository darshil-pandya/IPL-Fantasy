import type { PlayerNationality, PlayerRole } from "../types";

const ROLE_BASE =
  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ";

export function roleBadgeClass(role: PlayerRole): string {
  switch (role) {
    case "BAT":
      return `${ROLE_BASE}bg-sky-100 text-sky-900 ring-1 ring-sky-400/50`;
    case "BOWL":
      return `${ROLE_BASE}bg-rose-100 text-rose-900 ring-1 ring-rose-400/50`;
    case "AR":
      return `${ROLE_BASE}bg-emerald-100 text-emerald-900 ring-1 ring-emerald-400/50`;
    case "WK":
      return `${ROLE_BASE}bg-amber-100 text-amber-900 ring-1 ring-amber-400/50`;
  }
}

const NAT_BASE =
  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ";

export function natBadgeClass(n?: PlayerNationality): string {
  if (!n) return `${NAT_BASE}bg-slate-100 text-slate-500 ring-1 ring-slate-300`;
  return n === "IND"
    ? `${NAT_BASE}bg-emerald-100 text-emerald-900 ring-1 ring-emerald-400/50`
    : `${NAT_BASE}bg-violet-100 text-violet-900 ring-1 ring-violet-400/50`;
}
