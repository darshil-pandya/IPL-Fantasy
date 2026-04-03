/** Distinct accent per fantasy franchise owner (not IPL team colours). */
const OWNERS: Record<string, { pill: string; text: string }> = {
  Darshil: {
    pill: "bg-sky-600/35 text-sky-50 ring-sky-400/45",
    text: "text-sky-300",
  },
  Bhavya: {
    pill: "bg-fuchsia-700/35 text-fuchsia-50 ring-fuchsia-400/45",
    text: "text-fuchsia-300",
  },
  Prajin: {
    pill: "bg-teal-600/35 text-teal-50 ring-teal-400/45",
    text: "text-teal-300",
  },
  Sanket: {
    pill: "bg-orange-600/35 text-orange-50 ring-orange-400/45",
    text: "text-orange-300",
  },
  Hersh: {
    pill: "bg-lime-700/40 text-lime-50 ring-lime-400/45",
    text: "text-lime-300",
  },
  Jash: {
    pill: "bg-indigo-600/40 text-indigo-50 ring-indigo-400/45",
    text: "text-indigo-300",
  },
  Karan: {
    pill: "bg-rose-600/40 text-rose-50 ring-rose-400/45",
    text: "text-rose-300",
  },
};

const PILL =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ";

export function ownerPillClass(owner: string): string {
  const t = OWNERS[owner];
  return PILL + (t?.pill ?? "bg-slate-700/60 text-slate-100 ring-slate-500/40");
}

export function ownerNameClass(owner: string): string {
  return OWNERS[owner]?.text ?? "text-slate-300";
}
