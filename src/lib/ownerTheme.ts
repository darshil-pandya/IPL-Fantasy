/** Distinct accent per fantasy franchise owner (not IPL team colours). */
const OWNERS: Record<
  string,
  { pill: string; text: string; card: string; cardMuted: string }
> = {
  Darshil: {
    pill: "bg-sky-100 text-sky-900 ring-sky-400/50",
    text: "text-sky-800",
    card: "border-sky-300/60 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 shadow-sm ring-1 ring-sky-400/20",
    cardMuted: "text-sky-900/75",
  },
  Bhavya: {
    pill: "bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-400/50",
    text: "text-fuchsia-800",
    card: "border-fuchsia-300/55 bg-gradient-to-br from-fuchsia-50 via-white to-fuchsia-100/70 shadow-sm ring-1 ring-fuchsia-400/20",
    cardMuted: "text-fuchsia-900/75",
  },
  Prajin: {
    pill: "bg-teal-100 text-teal-900 ring-teal-400/50",
    text: "text-teal-800",
    card: "border-teal-300/55 bg-gradient-to-br from-teal-50 via-white to-teal-100/70 shadow-sm ring-1 ring-teal-400/20",
    cardMuted: "text-teal-900/75",
  },
  Sanket: {
    pill: "bg-orange-100 text-orange-900 ring-orange-400/50",
    text: "text-orange-800",
    card: "border-orange-300/55 bg-gradient-to-br from-orange-50 via-white to-orange-100/70 shadow-sm ring-1 ring-orange-400/20",
    cardMuted: "text-orange-900/75",
  },
  Hersh: {
    pill: "bg-lime-100 text-lime-900 ring-lime-500/45",
    text: "text-lime-800",
    card: "border-lime-400/50 bg-gradient-to-br from-lime-50 via-white to-lime-100/70 shadow-sm ring-1 ring-lime-500/20",
    cardMuted: "text-lime-900/75",
  },
  Jash: {
    pill: "bg-indigo-100 text-indigo-900 ring-indigo-400/50",
    text: "text-indigo-800",
    card: "border-indigo-300/55 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70 shadow-sm ring-1 ring-indigo-400/20",
    cardMuted: "text-indigo-900/75",
  },
  Karan: {
    pill: "bg-rose-100 text-rose-900 ring-rose-400/50",
    text: "text-rose-800",
    card: "border-rose-300/55 bg-gradient-to-br from-rose-50 via-white to-rose-100/70 shadow-sm ring-1 ring-rose-400/20",
    cardMuted: "text-rose-900/75",
  },
};

const PILL =
  "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ";

const CARD_BASE =
  "rounded-xl border px-3 py-2.5 transition-[box-shadow,transform] duration-150";

export function ownerPillClass(owner: string): string {
  const t = OWNERS[owner];
  return PILL + (t?.pill ?? "bg-slate-200 text-slate-800 ring-slate-400/50");
}

export function ownerNameClass(owner: string): string {
  return OWNERS[owner]?.text ?? "text-slate-700";
}

/** Card shell (border, wash, ring) for waiver / roster summaries. */
export function ownerCardClass(owner: string): string {
  const t = OWNERS[owner];
  return `${CARD_BASE} ${t?.card ?? "border-slate-300/60 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 shadow-sm ring-1 ring-slate-400/15"}`;
}

/** Muted label text on an owner card (owner name, captions). */
export function ownerCardMutedClass(owner: string): string {
  return OWNERS[owner]?.cardMuted ?? "text-slate-700/80";
}
