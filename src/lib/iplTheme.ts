/** IPL franchise colours as pill styles (inspired by official palettes). */
const IPL: Record<string, string> = {
  CSK: "bg-[#ffcc00]/25 text-yellow-50 ring-[#ffcc00]/55",
  MI: "bg-[#004ba0]/45 text-blue-50 ring-blue-300/45",
  RCB: "bg-[#ec1c24]/40 text-red-50 ring-red-400/50",
  KKR: "bg-[#3a225d]/50 text-purple-100 ring-purple-400/45",
  DC: "bg-[#2563eb]/40 text-blue-50 ring-blue-300/45",
  RR: "bg-[#e8298c]/35 text-pink-50 ring-pink-400/45",
  SRH: "bg-[#ff822a]/35 text-orange-50 ring-orange-400/50",
  PBKS: "bg-[#dd1f2d]/40 text-red-50 ring-red-400/45",
  LSG: "bg-[#00bfff]/30 text-cyan-50 ring-cyan-400/50",
  GT: "bg-[#1c2157]/55 text-indigo-100 ring-indigo-400/45",
};

const PILL =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ";

export function iplTeamPillClass(teamCode: string): string {
  const key = teamCode.trim().toUpperCase();
  return PILL + (IPL[key] ?? "bg-slate-700/60 text-slate-100 ring-slate-500/40");
}

export const IPL_TEAM_CODES = [
  "CSK",
  "MI",
  "RCB",
  "KKR",
  "DC",
  "RR",
  "SRH",
  "PBKS",
  "LSG",
  "GT",
] as const;
