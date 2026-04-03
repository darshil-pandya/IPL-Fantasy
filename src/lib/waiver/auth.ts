import type { WaiverSession } from "./types";
import { WAIVER_SESSION_LS_KEY } from "./constants";

/** Display label -> password (honor system; not secret). */
export const WAIVER_LOGIN_ROWS: { label: string; password: string }[] = [
  { label: "Admin", password: "admin@3395" },
  { label: "Bhavya", password: "bhavya@1234" },
  { label: "Darshil", password: "darshil@1234" },
  { label: "Hersh", password: "hersh@1234" },
  { label: "Jash", password: "jash@1234" },
  { label: "Karan", password: "karan@1234" },
  { label: "Prajin", password: "prajin@1234" },
  { label: "Sanket", password: "sanket@1234" },
];

export function sessionForLabel(label: string): WaiverSession | null {
  if (label === "Admin") return { role: "admin", label: "Admin" };
  const row = WAIVER_LOGIN_ROWS.find((r) => r.label === label);
  if (!row || row.label === "Admin") return null;
  return { role: "owner", label: row.label, owner: row.label };
}

export function verifyLogin(label: string, password: string): WaiverSession | null {
  const row = WAIVER_LOGIN_ROWS.find((r) => r.label === label);
  if (!row || row.password !== password) return null;
  return sessionForLabel(label);
}

export function loadSession(): WaiverSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(WAIVER_SESSION_LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as WaiverSession;
    if (o.role === "admin" && o.label === "Admin") return o;
    if (o.role === "owner" && typeof o.owner === "string") return o;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(s: WaiverSession | null): void {
  if (typeof localStorage === "undefined") return;
  if (!s) localStorage.removeItem(WAIVER_SESSION_LS_KEY);
  else localStorage.setItem(WAIVER_SESSION_LS_KEY, JSON.stringify(s));
}
