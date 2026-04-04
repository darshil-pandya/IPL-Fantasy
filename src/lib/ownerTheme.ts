/** Distinct accent per fantasy franchise owner (not IPL team colours). */
const OWNERS: Record<string, { pill: string; text: string }> = {
  Darshil: {
    pill: "bg-sky-100 text-sky-900 ring-sky-400/50",
    text: "text-sky-800",
  },
  Bhavya: {
    pill: "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-400/50",
    text: "text-fuchsia-800",
  },
  Prajin: {
    pill: "bg-teal-100 text-teal-900 ring-teal-400/50",
    text: "text-teal-800",
  },
  Sanket: {
    pill: "bg-orange-100 text-orange-900 ring-orange-400/50",
    text: "text-orange-800",
  },
  Hersh: {
    pill: "bg-lime-100 text-lime-900 ring-lime-500/45",
    text: "text-lime-800",
  },
  Jash: {
    pill: "bg-indigo-100 text-indigo-900 ring-indigo-400/50",
    text: "text-indigo-800",
  },
  Karan: {
    pill: "bg-rose-100 text-rose-900 ring-rose-400/50",
    text: "text-rose-800",
  },
};

const PILL =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ";

export function ownerPillClass(owner: string): string {
  const t = OWNERS[owner];
  return PILL + (t?.pill ?? "bg-slate-200 text-slate-800 ring-slate-400/50");
}

export function ownerNameClass(owner: string): string {
  return OWNERS[owner]?.text ?? "text-slate-700";
}
