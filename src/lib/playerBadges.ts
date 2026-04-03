import type { PlayerNationality, PlayerRole } from "../types";

const ROLE_BASE =
  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ";

export function roleBadgeClass(role: PlayerRole): string {
  switch (role) {
    case "BAT":
      return `${ROLE_BASE}bg-sky-600/35 text-sky-200 ring-1 ring-sky-500/40`;
    case "BOWL":
      return `${ROLE_BASE}bg-rose-700/35 text-rose-100 ring-1 ring-rose-500/40`;
    case "AR":
      return `${ROLE_BASE}bg-emerald-700/35 text-emerald-100 ring-1 ring-emerald-500/40`;
    case "WK":
      return `${ROLE_BASE}bg-amber-600/35 text-amber-100 ring-1 ring-amber-500/40`;
  }
}

const NAT_BASE =
  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ";

export function natBadgeClass(n?: PlayerNationality): string {
  if (!n) return `${NAT_BASE}bg-slate-800 text-slate-500 ring-1 ring-slate-600/40`;
  return n === "IND"
    ? `${NAT_BASE}bg-emerald-800/40 text-emerald-100 ring-1 ring-emerald-600/35`
    : `${NAT_BASE}bg-violet-800/40 text-violet-100 ring-1 ring-violet-500/35`;
}
