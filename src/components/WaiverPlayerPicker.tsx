import { useEffect, useMemo, useRef, useState } from "react";
import { IplTeamPill } from "./IplTeamPill";
import { natBadgeClass, roleBadgeClass } from "../lib/playerBadges";
import type { Player, PlayerNationality } from "../types";

function natLabel(n?: PlayerNationality): string {
  if (n === "IND") return "India";
  if (n === "OVS") return "Overseas";
  return "—";
}

function PlayerRowInner({ p }: { p: Player }) {
  return (
    <>
      <span className="block font-medium text-brand-dark">{p.name}</span>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <IplTeamPill code={p.iplTeam} />
        <span className={roleBadgeClass(p.role)}>{p.role}</span>
        <span className={natBadgeClass(p.nationality)}>{natLabel(p.nationality)}</span>
        <span className="rounded-full bg-brand-dark/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-ocean">
          {p.seasonTotal.toFixed(1)} pts
        </span>
      </div>
    </>
  );
}

type WaiverPlayerPickerProps = {
  label: string;
  value: string;
  onChange: (playerId: string) => void;
  playerIds: string[];
  pmap: Map<string, Player>;
  placeholder?: string;
  /** Show a name search field and filter the list as you type. */
  searchable?: boolean;
};

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

export function WaiverPlayerPicker({
  label,
  value,
  onChange,
  playerIds,
  pmap,
  placeholder = "Select player…",
  searchable = false,
}: WaiverPlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const sortedIds = useMemo(() => {
    return [...playerIds].sort((a, b) => {
      const na = pmap.get(a)?.name ?? a;
      const nb = pmap.get(b)?.name ?? b;
      return na.localeCompare(nb);
    });
  }, [playerIds, pmap]);

  const filteredIds = useMemo(() => {
    if (!searchable) return sortedIds;
    const q = normalizeSearch(filterQuery);
    if (!q) return sortedIds;
    return sortedIds.filter((id) => {
      const name = pmap.get(id)?.name ?? id;
      return normalizeSearch(name).includes(q);
    });
  }, [searchable, sortedIds, filterQuery, pmap]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      searchInputRef.current?.focus();
    }
  }, [open, searchable]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  const selected = value ? pmap.get(value) : undefined;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {searchable && (
        <input
          ref={searchInputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={filterQuery}
          onChange={(e) => {
            setFilterQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type player name to filter…"
          aria-label={`${label} — search by name`}
          className="app-input w-full py-2 text-sm"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="app-input flex min-h-[2.75rem] w-full items-start justify-between gap-2 py-2 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selected ? (
            <PlayerRowInner p={selected} />
          ) : (
            <span className="self-center text-sm text-slate-400">{placeholder}</span>
          )}
        </div>
        <span className="shrink-0 pt-0.5 text-brand-dark/45" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <ul
          className="absolute top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-brand-cyan/60 bg-white py-1 shadow-lg ring-1 ring-brand-dark/5"
          role="listbox"
          aria-label={label}
        >
          {sortedIds.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-slate-500">No players</li>
          ) : filteredIds.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              No names match &ldquo;{filterQuery.trim()}&rdquo;
            </li>
          ) : (
            filteredIds.map((id) => {
              const p = pmap.get(id);
              if (!p) return null;
              return (
                <li key={id} role="option" aria-selected={value === id}>
                  <button
                    type="button"
                    className="w-full border-b border-brand-pale/80 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-brand-pale/70 focus:bg-brand-pale/70 focus:outline-none"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                      setFilterQuery("");
                    }}
                  >
                    <PlayerRowInner p={p} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
