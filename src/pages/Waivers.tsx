import { useEffect, useMemo, useState } from "react";
import { IplTeamPill } from "../components/IplTeamPill";
import { OwnerBadge } from "../components/OwnerBadge";
import { useLeague } from "../context/LeagueContext";
import { useWaiver } from "../context/WaiverContext";
import type { WaiverEngineAction } from "../lib/waiver/engine";
import {
  WAIVER_BID_INCREMENT,
  WAIVER_BUDGET_START,
} from "../lib/waiver/constants";
import { WAIVER_LOGIN_ROWS } from "../lib/waiver/auth";
import type { LeagueBundle, Player } from "../types";
import type { WaiverBid, WaiverNomination, WaiverSession } from "../lib/waiver/types";
import { isFirebaseConfigured } from "../lib/firebase/client";
import { seedLeagueFromStaticToFirestore } from "../lib/firebase/leagueRemote";

function money(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function firebaseUi(connected: boolean, err: string | null): React.ReactNode {
  if (!isFirebaseConfigured()) {
    return (
      <p className="mt-2 text-xs text-slate-600">
        Firestore sync off — this build needs all three{" "}
        <code className="text-slate-500">VITE_FIREBASE_*</code> vars at build time (see
        docs/firebase-waiver-setup.md).
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-slate-500">
      Firestore: {connected ? "listening" : "connecting…"}
      {err ? <span className="text-rose-400"> — {err}</span> : null}
    </p>
  );
}

export function Waivers() {
  const { bundle } = useLeague();
  const {
    session,
    login,
    logout,
    state,
    dispatch,
    displayFranchises,
    availableIds,
    remoteConnected,
    remoteError,
  } = useWaiver();

  const [userLabel, setUserLabel] = useState(WAIVER_LOGIN_ROWS[0]!.label);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const pmap = useMemo(() => {
    const m = new Map<string, Player>();
    if (!bundle) return m;
    for (const p of bundle.players) m.set(p.id, p);
    return m;
  }, [bundle]);

  const ownerFranchise = useMemo(() => {
    if (!session || session.role !== "owner") return null;
    return displayFranchises.find((f) => f.owner === session.owner) ?? null;
  }, [session, displayFranchises]);

  const myNominations = useMemo(() => {
    if (!session || session.role !== "owner") return [];
    return state.nominations.filter((n) => n.nominatorOwner === session.owner);
  }, [session, state.nominations]);

  const nominatedInIds = useMemo(
    () => new Set(state.nominations.map((n) => n.playerInId)),
    [state.nominations],
  );

  function runDispatch(a: WaiverEngineAction): string | null {
    setActionErr(null);
    const err = dispatch(a);
    if (err) setActionErr(err);
    return err;
  }

  function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr(null);
    const err = login(userLabel, password);
    if (err) setLoginErr(err);
    else setPassword("");
  }

  function exportRosters() {
    if (!bundle) return;
    const out = { franchises: displayFranchises };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "franchises-after-waiver.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!bundle) return null;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">Waiver center</h2>
        <p className="mt-2 text-sm text-slate-400">
          Other owners&apos; bid amounts stay off this screen until the commissioner reveals
          the round (honor system). Phase:{" "}
          <strong className="text-amber-200/90">{state.phase}</strong>
          {state.roundId > 0 ? (
            <span className="text-slate-500"> · Round {state.roundId}</span>
          ) : null}
          . Budget per owner: {money(WAIVER_BUDGET_START)} · Bids in{" "}
          {money(WAIVER_BID_INCREMENT)} steps.
        </p>
        {firebaseUi(remoteConnected, remoteError)}
        {!session ? (
          <form
            onSubmit={doLogin}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              <span className="text-xs uppercase text-slate-500">User</span>
              <select
                value={userLabel}
                onChange={(e) => setUserLabel(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              >
                {WAIVER_LOGIN_ROWS.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              <span className="text-xs uppercase text-slate-500">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-[12rem] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700/50 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-600/40 hover:bg-emerald-700/70"
            >
              Sign in
            </button>
            {loginErr && (
              <p className="text-sm text-rose-300 sm:w-full">{loginErr}</p>
            )}
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">
              Signed in as{" "}
              <strong className="text-white">{session.label}</strong> (
              {session.role})
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        )}
      </section>

      {session?.role === "admin" && (
        <AdminPanel
          dispatch={(a) => {
            runDispatch(a);
          }}
          error={actionErr}
          onExport={exportRosters}
        />
      )}

      {session?.role === "owner" && ownerFranchise && (
        <OwnerWaiverPanel
          sessionOwner={session.owner}
          franchise={ownerFranchise}
          phase={state.phase}
          myNominations={myNominations}
          nominatedInIds={nominatedInIds}
          availableIds={availableIds}
          budgetRemaining={state.budgets[session.owner] ?? 0}
          pmap={pmap}
          tryDispatch={runDispatch}
          error={actionErr}
        />
      )}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Nominations this round
        </h3>
        {state.nominations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {state.nominations.map((n) => (
              <NominationRow
                key={n.id}
                n={n}
                pmap={pmap}
                bids={state.bids.filter((b) => b.nominationId === n.id)}
                phase={state.phase}
                session={session}
                myRosterIds={
                  session?.role === "owner"
                    ? (displayFranchises.find((f) => f.owner === session.owner)
                        ?.playerIds ?? [])
                    : []
                }
                budgetRemaining={
                  session?.role === "owner"
                    ? (state.budgets[session.owner] ?? 0)
                    : 0
                }
                tryDispatch={runDispatch}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Event log (recent)
        </h3>
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3 font-mono text-xs text-slate-400">
          {[...state.log].reverse().map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className="text-slate-600">{e.at}</span> [{e.kind}]{" "}
              {e.message}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
        <h3 className="text-sm font-semibold text-white">Original auction</h3>
        <p className="mt-1 text-xs text-slate-500">
          Static history from <code className="text-amber-200/80">auction.json</code>.
        </p>
        <AuctionHistorySnippet bundle={bundle} pmap={pmap} />
      </section>
    </div>
  );
}

function AdminPanel({
  dispatch,
  error,
  onExport,
}: {
  dispatch: (a: WaiverEngineAction) => void;
  error: string | null;
  onExport: () => void;
}) {
  const [pubBusy, setPubBusy] = useState(false);
  const [pubFeedback, setPubFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  async function publishLeagueToFirestore() {
    if (!isFirebaseConfigured()) return;
    setPubFeedback(null);
    setPubBusy(true);
    try {
      await seedLeagueFromStaticToFirestore();
      setPubFeedback({
        kind: "ok",
        text: "League bundle written to Firestore. Other tabs and devices will update automatically.",
      });
    } catch (e) {
      setPubFeedback({
        kind: "err",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPubBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-900/40 bg-amber-950/15 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
        Commissioner
      </h3>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "admin_start_nomination" })}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Start nomination phase
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "admin_start_bidding" })}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Start bidding phase
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "admin_reveal" })}
          className="rounded-xl bg-emerald-800/50 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-600/40 hover:bg-emerald-800/70"
        >
          Reveal results
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Export rosters JSON
        </button>
        <button
          type="button"
          disabled={pubBusy || !isFirebaseConfigured()}
          title={
            !isFirebaseConfigured()
              ? "Add all three VITE_FIREBASE_* secrets and redeploy so this build can use Firestore."
              : undefined
          }
          onClick={() => void publishLeagueToFirestore()}
          className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-2 text-sm text-amber-100 hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pubBusy ? "Publishing…" : "Publish league to Firestore"}
        </button>
      </div>
      {!isFirebaseConfigured() && (
        <p className="mt-3 text-xs leading-relaxed text-amber-200/85">
          <strong className="font-medium text-amber-100/90">Publish is disabled.</strong> This
          deploy must include all three Firebase env vars at <em>build</em> time. In GitHub:{" "}
          <strong>Settings → Secrets and variables → Actions</strong>, add{" "}
          <code className="rounded bg-slate-900/80 px-1 text-[0.7rem] text-slate-300">
            VITE_FIREBASE_API_KEY
          </code>
          ,{" "}
          <code className="rounded bg-slate-900/80 px-1 text-[0.7rem] text-slate-300">
            VITE_FIREBASE_AUTH_DOMAIN
          </code>
          , and{" "}
          <code className="rounded bg-slate-900/80 px-1 text-[0.7rem] text-slate-300">
            VITE_FIREBASE_PROJECT_ID
          </code>
          (exact names), then push to <code className="text-slate-400">main</code> or re-run{" "}
          <strong>Deploy to GitHub Pages</strong>. If only the API key was set, Waivers could
          misleadingly say “listening” before — that is fixed in this version.
        </p>
      )}
      {pubFeedback && (
        <p
          className={
            pubFeedback.kind === "ok"
              ? "mt-3 text-xs text-emerald-300/90"
              : "mt-3 text-xs text-rose-300"
          }
        >
          {pubFeedback.text}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      <p className="mt-3 text-xs text-slate-500">
        Strict flow: idle → nomination → bidding → reveal → idle. Reveal resolves
        every nomination at once; winning bids deduct budget and update rosters.
      </p>
    </section>
  );
}

function OwnerWaiverPanel({
  sessionOwner,
  franchise,
  phase,
  myNominations,
  nominatedInIds,
  availableIds,
  budgetRemaining,
  pmap,
  tryDispatch,
  error,
}: {
  sessionOwner: string;
  franchise: { owner: string; teamName: string; playerIds: string[] };
  phase: string;
  myNominations: WaiverNomination[];
  nominatedInIds: Set<string>;
  availableIds: string[];
  budgetRemaining: number;
  pmap: Map<string, Player>;
  tryDispatch: (a: WaiverEngineAction) => string | null;
  error: string | null;
}) {
  const [nomIn, setNomIn] = useState("");
  const [nomOut, setNomOut] = useState("");
  const [nomAmt, setNomAmt] = useState(String(WAIVER_BID_INCREMENT * 2));
  const [editId, setEditId] = useState<string | null>(null);

  const availOptions = availableIds.filter((id) => !nominatedInIds.has(id));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-white">{franchise.teamName}</h3>
        <OwnerBadge owner={sessionOwner} />
        <span className="text-sm text-slate-500">
          Budget left:{" "}
          <span className="tabular-nums text-amber-200">{money(budgetRemaining)}</span>
        </span>
      </div>
      {phase === "nomination" && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(nomAmt);
            const err = tryDispatch({
              type: "nomination_upsert",
              owner: sessionOwner,
              nominationId: editId,
              playerInId: nomIn,
              playerOutId: nomOut,
              amount,
            });
            if (!err) {
              setEditId(null);
              setNomIn("");
              setNomOut("");
            }
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Nominee (available)
            <select
              required
              value={nomIn}
              onChange={(e) => setNomIn(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {availOptions.map((id) => (
                <option key={id} value={id}>
                  {pmap.get(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Your player out
            <select
              required
              value={nomOut}
              onChange={(e) => setNomOut(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
            >
              <option value="">Select…</option>
              {franchise.playerIds.map((id) => (
                <option key={id} value={id}>
                  {pmap.get(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Your bid (₹)
            <input
              type="number"
              step={WAIVER_BID_INCREMENT}
              min={WAIVER_BID_INCREMENT}
              value={nomAmt}
              onChange={(e) => setNomAmt(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-700/40 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-600/35"
            >
              {editId ? "Update nomination" : "Add nomination"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setNomIn("");
                  setNomOut("");
                }}
                className="text-sm text-slate-500 hover:text-slate-300"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}
      {myNominations.length > 0 && phase === "nomination" && (
        <ul className="mt-4 space-y-2 text-sm">
          {myNominations.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
            >
              <span className="text-slate-300">
                {pmap.get(n.playerInId)?.name} in ·{" "}
                {pmap.get(n.playerOutId)?.name} out · {money(n.amount)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-amber-400/90 hover:text-amber-300"
                  onClick={() => {
                    setEditId(n.id);
                    setNomIn(n.playerInId);
                    setNomOut(n.playerOutId);
                    setNomAmt(String(n.amount));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-rose-400/90 hover:text-rose-300"
                  onClick={() =>
                    tryDispatch({
                      type: "nomination_delete",
                      owner: sessionOwner,
                      nominationId: n.id,
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </section>
  );
}

function NominationRow({
  n,
  pmap,
  bids,
  phase,
  session,
  myRosterIds,
  budgetRemaining,
  tryDispatch,
}: {
  n: WaiverNomination;
  pmap: Map<string, Player>;
  bids: WaiverBid[];
  phase: string;
  session: WaiverSession | null;
  myRosterIds: string[];
  budgetRemaining: number;
  tryDispatch: (a: WaiverEngineAction) => string | null;
}) {
  const pIn = pmap.get(n.playerInId);
  const existing =
    session?.role === "owner"
      ? bids.find((b) => b.bidderOwner === session.owner)
      : undefined;
  const [outId, setOutId] = useState(existing?.playerOutId ?? "");
  const [amt, setAmt] = useState(
    String(existing?.amount ?? WAIVER_BID_INCREMENT * 2),
  );

  useEffect(() => {
    setOutId(existing?.playerOutId ?? "");
    setAmt(String(existing?.amount ?? WAIVER_BID_INCREMENT * 2));
  }, [existing?.id, existing?.playerOutId, existing?.amount]);

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-white">{pIn?.name ?? n.playerInId}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {pIn && <IplTeamPill code={pIn.iplTeam} />}
            <span>
              Listed by <OwnerBadge owner={n.nominatorOwner} /> · opens{" "}
              {pmap.get(n.playerOutId)?.name ?? n.playerOutId} / {money(n.amount)}
            </span>
          </p>
        </div>
      </div>
      {phase === "bidding" &&
        session?.role === "owner" &&
        session.owner !== n.nominatorOwner && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            tryDispatch({
              type: "bid_upsert",
              bidderOwner: session.owner,
              nominationId: n.id,
              playerOutId: outId,
              amount: Number(amt),
            });
          }}
        >
          <span className="w-full text-xs text-slate-500">
            Your bid · budget {money(budgetRemaining)}
          </span>
          <select
            required
            value={outId}
            onChange={(e) => setOutId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
          >
            <option value="">Player out…</option>
            {myRosterIds.map((id) => (
              <option key={id} value={id}>
                {pmap.get(id)?.name ?? id}
              </option>
            ))}
          </select>
          <input
            type="number"
            step={WAIVER_BID_INCREMENT}
            min={WAIVER_BID_INCREMENT}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            className="w-32 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600"
          >
            {existing ? "Update bid" : "Place bid"}
          </button>
        </form>
      )}
      {phase === "bidding" &&
        session?.role === "owner" &&
        session.owner === n.nominatorOwner && (
          <p className="mt-3 text-xs text-slate-500">
            Your opening bid is locked from nomination phase; others are bidding now.
          </p>
        )}
    </li>
  );
}

function AuctionHistorySnippet({
  bundle,
  pmap,
}: {
  bundle: LeagueBundle;
  pmap: Map<string, { name: string }>;
}) {
  const sales = [...bundle.auction.sales].slice(0, 8);
  if (sales.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">No sales in file.</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-sm text-slate-400">
      {sales.map((s) => (
        <li key={`${s.playerId}-${s.soldAt}`}>
          {pmap.get(s.playerId)?.name ?? s.playerId} → {s.soldToOwner} · {s.amountCr}{" "}
          Cr
        </li>
      ))}
    </ul>
  );
}
