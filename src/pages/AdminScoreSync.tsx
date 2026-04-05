import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeague } from "../context/LeagueContext";
import { useWaiver } from "../context/WaiverContext";
import {
  callAdminScoreSync,
  type AdminScoreSyncResponse,
} from "../lib/firebase/adminScoreSyncCall";
import { isFirebaseConfigured } from "../lib/firebase/client";
import type { Player } from "../types";

export function AdminScoreSync() {
  const { bundle } = useLeague();
  const { session } = useWaiver();
  const [matchQuery, setMatchQuery] = useState("");
  const [adminSyncSecret, setAdminSyncSecret] = useState("");
  const [writeToFirestore, setWriteToFirestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<AdminScoreSyncResponse | null>(null);

  const pmap = useMemo(() => {
    const m = new Map<string, Player>();
    if (!bundle) return m;
    for (const p of bundle.players) m.set(p.id, p);
    for (const p of bundle.waiverPool ?? []) {
      if (!m.has(p.id)) m.set(p.id, p);
    }
    return m;
  }, [bundle]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    if (!matchQuery.trim()) {
      setErr("Enter a match query (e.g. CSK vs RR).");
      return;
    }
    if (!adminSyncSecret.trim()) {
      setErr("Enter the score-sync secret (set as Cloud Function secret ADMIN_SCORE_SYNC_SECRET).");
      return;
    }
    setBusy(true);
    try {
      const data = await callAdminScoreSync({
        matchQuery: matchQuery.trim(),
        adminSyncSecret: adminSyncSecret.trim(),
        writeToFirestore,
      });
      setResult(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (session?.role !== "admin") {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-brand-dark">Score sync</h2>
        <p className="text-sm text-slate-700">
          This page is only available after you log in as <strong>Admin</strong> on the{" "}
          <Link to="/waivers" className="text-brand-ocean underline">
            Waivers
          </Link>{" "}
          page (same session).
        </p>
      </div>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-brand-dark">Score sync</h2>
        <p className="text-sm text-slate-700">
          Configure all three <code className="text-slate-600">VITE_FIREBASE_*</code> variables at
          build time. See docs for Firebase setup.
        </p>
      </div>
    );
  }

  const pointRows =
    result?.playerPoints &&
    Object.entries(result.playerPoints)
      .map(([id, pts]) => {
        const p = pmap.get(id);
        return { id, pts, name: p?.name ?? id };
      })
      .sort((a, b) => b.pts - a.pts);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-dark">Admin — score sync</h2>
        <p className="mt-1 text-sm text-slate-600">
          Finds the match on Cricbuzz and ESPN, compares scorecard-derived fantasy points, and
          optionally writes validated results to{" "}
          <code className="rounded bg-brand-pale px-1 text-brand-dark">iplFantasy/fantasyMatchScores</code>
          .
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-brand-cyan/40 bg-white/80 p-4 shadow-sm">
        <label className="block text-sm font-medium text-brand-dark">
          Match query
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. CSK vs RR"
            value={matchQuery}
            onChange={(e) => setMatchQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm font-medium text-brand-dark">
          Score-sync secret
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="ADMIN_SCORE_SYNC_SECRET (Cloud Function secret)"
            value={adminSyncSecret}
            onChange={(e) => setAdminSyncSecret(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={writeToFirestore}
            onChange={(e) => setWriteToFirestore(e.target.checked)}
          />
          Write to Firestore when Cricbuzz and ESPN agree (and the scorecard looks complete)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="app-btn-primary disabled:opacity-50"
        >
          {busy ? "Running…" : "Run sync"}
        </button>
      </form>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      {result?.ok ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium text-brand-dark">Match:</span> {result.matchLabel}
          </p>
          <p className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
            <a
              href={result.cricbuzzUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-ocean underline"
            >
              Cricbuzz scorecard
            </a>
            <a
              href={result.espnUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-ocean underline"
            >
              ESPN scorecard
            </a>
          </p>
          <p>
            <span className="font-medium text-brand-dark">Cross-source validation:</span>{" "}
            {result.validated ? (
              <span className="text-emerald-700">passed for roster-mapped players</span>
            ) : (
              <span className="text-amber-800">failed — see log below</span>
            )}
          </p>
          {result.wroteFirestore ? (
            <p className="font-medium text-emerald-800">Firestore updated for this match.</p>
          ) : null}
          {result.note ? <p className="text-slate-600">{result.note}</p> : null}

          {pointRows && pointRows.length > 0 ? (
            <div>
              <p className="mb-2 font-medium text-brand-dark">Player points (league roster)</p>
              <ul className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs sm:text-sm">
                {pointRows.map(({ id, name, pts }) => (
                  <li key={id} className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                    <span>{name}</span>
                    <span className="tabular-nums">{pts.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.warnings && result.warnings.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-dark">Warnings</h3>
          <ul className="list-inside list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result?.inconsistencies && result.inconsistencies.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-red-900">Inconsistencies / blocking issues</h3>
          <ul className="list-inside list-disc space-y-1 rounded-lg border border-red-200 bg-red-50/80 p-3 text-sm text-red-950">
            {result.inconsistencies.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
