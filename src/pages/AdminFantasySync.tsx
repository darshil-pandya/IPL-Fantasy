import { useMemo, useState } from "react";
import { useLeague } from "../context/LeagueContext";
import { isFirebaseConfigured } from "../lib/firebase/client";
import { callSyncMatchFantasyScores } from "../lib/firebase/syncMatchScores";

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AdminFantasySync() {
  const { bundle, fantasyOverlayNotice } = useLeague();
  const [passphrase, setPassphrase] = useState("");
  const [cricketMatchId, setCricketMatchId] = useState("");
  const [matchKey, setMatchKey] = useState("");
  const [matchLabel, setMatchLabel] = useState("");
  const [matchDate, setMatchDate] = useState(todayIsoDate);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const roster = useMemo(() => {
    if (!bundle) return [];
    const m = new Map<string, string>();
    for (const p of bundle.players) m.set(p.id, p.name);
    if (bundle.waiverPool) {
      for (const p of bundle.waiverPool) {
        if (!m.has(p.id)) m.set(p.id, p.name);
      }
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [bundle]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    if (!passphrase.trim()) {
      setErr("Enter the sync passphrase (set as a Firebase Function secret).");
      return;
    }
    if (!cricketMatchId.trim() || !matchKey.trim() || !matchLabel.trim()) {
      setErr("Cricket match id, league match key, and label are required.");
      return;
    }
    setBusy(true);
    try {
      const data = await callSyncMatchFantasyScores({
        passphrase: passphrase.trim(),
        cricketMatchId: cricketMatchId.trim(),
        matchKey: matchKey.trim(),
        matchLabel: matchLabel.trim(),
        matchDate: matchDate.trim() || todayIsoDate(),
        players: roster,
      });
      setResult(
        data.message ??
          (data.ok ? "Sync completed." : JSON.stringify(data, null, 2)),
      );
    } catch (e: unknown) {
      const msg =
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as { message: string }).message === "string"
          ? (e as { message: string }).message
          : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <section className="app-card p-5">
        <h2 className="text-lg font-semibold text-brand-dark">Score sync (admin)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Add <code className="text-xs">VITE_FIREBASE_*</code> env vars and redeploy so this
          page can call Cloud Functions.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-5">
        <h2 className="text-lg font-semibold text-brand-dark">Score sync (admin)</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Fetches{" "}
          <a
            href="https://cricketdata.org/how-to-use-fantasy-cricket-api.aspx"
            className="font-medium text-brand-ocean underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Cricket Data
          </a>{" "}
          <code className="rounded bg-brand-pale px-1 text-xs">fantasySummary</code> for the
          match you choose, then writes fantasy points into Firestore at{" "}
          <code className="text-xs">iplFantasy/fantasyMatchScores</code>. The app merges those
          points into each player&apos;s <code className="text-xs">byMatch</code> list.
        </p>
        <p className="mt-2 text-xs text-amber-900/90">
          <strong className="font-medium">Demo scoring:</strong> the cloud function currently
          maps <em>batting runs only</em> (name match to your roster). Replace the parser in{" "}
          <code className="rounded bg-amber-100 px-1">functions/src/cricketdata.ts</code> with
          your full IPL 2026 rules when ready.
        </p>
        {fantasyOverlayNotice ? (
          <p className="mt-2 text-sm text-red-700">
            Listener: {fantasyOverlayNotice}
          </p>
        ) : null}
      </section>

      <section className="app-card p-5">
        <h3 className="text-sm font-semibold text-brand-dark">Run sync</h3>
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Sync passphrase
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="app-input py-2 text-sm"
              placeholder="Same value as FANTASY_SYNC_PASSPHRASE secret"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Cricket Data match id
            <input
              value={cricketMatchId}
              onChange={(e) => setCricketMatchId(e.target.value)}
              className="app-input py-2 text-sm"
              placeholder="From API (e.g. match_info / currentMatches listing)"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            League match key (stable)
            <input
              value={matchKey}
              onChange={(e) => setMatchKey(e.target.value)}
              className="app-input py-2 text-sm"
              placeholder="e.g. IPL2026-M14"
            />
            <span className="text-[10px] text-slate-500">
              Re-use the same key to overwrite that match after a correction.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Display label
            <input
              value={matchLabel}
              onChange={(e) => setMatchLabel(e.target.value)}
              className="app-input py-2 text-sm"
              placeholder="e.g. GT vs CSK"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Match date
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="app-input py-2 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">
            Roster for name matching:{" "}
            <strong className="text-brand-dark">{roster.length}</strong> players (main list +
            waiver pool).
          </p>
          <button
            type="submit"
            disabled={busy || roster.length === 0}
            className="app-btn-primary w-fit disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Syncing…" : "Fetch & write scores"}
          </button>
        </form>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        {result && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {result}
          </p>
        )}
      </section>
    </div>
  );
}
