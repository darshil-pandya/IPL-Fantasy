/** IPL franchise colours as pill styles (inspired by official palettes). */
const IPL: Record<string, string> = {
  CSK: "bg-[#ffcc00]/35 text-yellow-950 ring-[#ca8a04]/50",
  MI: "bg-[#004ba0]/20 text-[#004ba0] ring-[#004ba0]/40",
  RCB: "bg-[#ec1c24]/20 text-[#b91c1c] ring-red-400/50",
  KKR: "bg-[#3a225d]/20 text-[#3a225d] ring-purple-400/45",
  DC: "bg-[#2563eb]/20 text-[#1d4ed8] ring-blue-400/45",
  RR: "bg-[#e8298c]/20 text-pink-800 ring-pink-400/45",
  SRH: "bg-[#ff822a]/25 text-orange-900 ring-orange-400/50",
  PBKS: "bg-[#dd1f2d]/20 text-red-800 ring-red-400/45",
  LSG: "bg-[#00bfff]/25 text-cyan-900 ring-cyan-500/50",
  GT: "bg-[#1c2157]/15 text-[#1c2157] ring-indigo-400/45",
};

const PILL =
  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ";

export function iplTeamPillClass(teamCode: string): string {
  const key = teamCode.trim().toUpperCase();
  return PILL + (IPL[key] ?? "bg-slate-200 text-slate-800 ring-slate-400/50");
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
