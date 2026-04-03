import { useCallback, useEffect, useMemo, useState } from "react";
import { OwnerBadge } from "../components/OwnerBadge";
import { IplTeamPill } from "../components/IplTeamPill";
import { useLeague } from "../context/LeagueContext";
import { IPL_TEAM_CODES } from "../lib/iplTheme";
import { notifyPredictionActualsChanged } from "../lib/predictionEvents";
import {
  countCorrectPicks,
  exportActualsJson,
  loadStoredActuals,
  mergeActuals,
  saveStoredActuals,
} from "../lib/predictions";
import type { PredictionActuals } from "../types";

function normTeam(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function normName(a: string, b: string): boolean {
  return (
    a
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ") ===
    b.trim().toLowerCase().replace(/\s+/g, " ")
  );
}

function StatusPill({
  resolved,
  correct,
}: {
  resolved: boolean;
  correct: boolean;
}) {
  if (!resolved) {
    return (
      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-600/60">
        Pending
      </span>
    );
  }
  if (correct) {
    return (
      <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-600/50">
        Match
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-600/60">
      Miss
    </span>
  );
}

export function Predictions() {
  const { bundle } = useLeague();
  const [actuals, setActuals] = useState<PredictionActuals | null>(null);

  useEffect(() => {
    if (!bundle?.predictions) return;
    setActuals(
      mergeActuals(bundle.predictions.actuals, loadStoredActuals()),
    );
  }, [bundle]);

  const pred = bundle?.predictions;
  const playerNames = useMemo(() => {
    if (!bundle) return [];
    return [...new Set(bundle.players.map((p) => p.name))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [bundle]);

  const patch = useCallback(
    (partial: Partial<PredictionActuals>) => {
      if (!pred || !actuals) return;
      const next: PredictionActuals = {
        winner: partial.winner !== undefined ? partial.winner : actuals.winner,
        runnerUp:
          partial.runnerUp !== undefined ? partial.runnerUp : actuals.runnerUp,
        orangeCap:
          partial.orangeCap !== undefined ? partial.orangeCap : actuals.orangeCap,
        purpleCap:
          partial.purpleCap !== undefined ? partial.purpleCap : actuals.purpleCap,
      };
      setActuals(next);
      saveStoredActuals(next);
      notifyPredictionActualsChanged();
    },
    [pred, actuals],
  );

  if (!bundle || !pred || !actuals) return null;

  const pts = pred.pointsPerCorrect;

  const catStats = {
    winner: {
      label: "Winner",
      actual: actuals.winner,
      count: pred.picks.filter(
        (p) => actuals.winner && normTeam(p.winner, actuals.winner),
      ).length,
    },
    runnerUp: {
      label: "Runner-up",
      actual: actuals.runnerUp,
      count: pred.picks.filter(
        (p) => actuals.runnerUp && normTeam(p.runnerUp, actuals.runnerUp),
      ).length,
    },
    orange: {
      label: "Orange Cap",
      actual: actuals.orangeCap,
      count: pred.picks.filter(
        (p) =>
          actuals.orangeCap && normName(p.orangeCap, actuals.orangeCap),
      ).length,
    },
    purple: {
      label: "Purple Cap",
      actual: actuals.purpleCap,
      count: pred.picks.filter(
        (p) =>
          actuals.purpleCap && normName(p.purpleCap, actuals.purpleCap),
      ).length,
    },
  };

  const selectClass =
    "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white min-w-[8rem]";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold uppercase tracking-wide text-white">
          Predictions
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Each correct prediction wins <strong className="text-amber-200/90">{pts} pts</strong>.
          Bonus flows into the leaderboard. Picks are stored in{" "}
          <code className="text-amber-200/80">predictions.json</code>. Season results can be
          saved in this browser or pasted into <code className="text-amber-200/80">actuals</code>{" "}
          for everyone.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Season results (moderator)
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Winner
            <select
              className={selectClass}
              value={actuals.winner ?? ""}
              onChange={(e) => patch({ winner: e.target.value || null })}
            >
              <option value="">Pending</option>
              {IPL_TEAM_CODES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Runner-up
            <select
              className={selectClass}
              value={actuals.runnerUp ?? ""}
              onChange={(e) => patch({ runnerUp: e.target.value || null })}
            >
              <option value="">Pending</option>
              {IPL_TEAM_CODES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Orange Cap
            <select
              className={selectClass + " min-w-[12rem]"}
              value={actuals.orangeCap ?? ""}
              onChange={(e) => patch({ orangeCap: e.target.value || null })}
            >
              <option value="">Pending</option>
              {playerNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Purple Cap
            <select
              className={selectClass + " min-w-[12rem]"}
              value={actuals.purpleCap ?? ""}
              onChange={(e) => patch({ purpleCap: e.target.value || null })}
            >
              <option value="">Pending</option>
              {playerNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => {
              void navigator.clipboard.writeText(exportActualsJson(actuals));
            }}
          >
            Copy actuals JSON
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => {
              saveStoredActuals(pred.actuals);
              setActuals({ ...pred.actuals });
              notifyPredictionActualsChanged();
            }}
          >
            Reset to file defaults
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.values(catStats).map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold text-white">
              {c.actual ? (
                c.label.includes("Cap") ? (
                  c.actual
                ) : (
                  <IplTeamPill code={c.actual} />
                )
              ) : (
                "Pending"
              )}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {c.count} correct · {pts} pts each
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/90 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Franchise</th>
              <th className="px-3 py-3 font-medium">Winner pick</th>
              <th className="px-3 py-3 font-medium">Runner-up pick</th>
              <th className="px-3 py-3 font-medium">Orange Cap pick</th>
              <th className="px-3 py-3 font-medium">Purple Cap pick</th>
              <th className="px-3 py-3 text-right font-medium">Correct</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {pred.picks.map((pick) => {
              const nCorrect = countCorrectPicks(pick, actuals);
              const wRes = !!actuals.winner;
              const wOk = wRes && normTeam(pick.winner, actuals.winner!);
              const rRes = !!actuals.runnerUp;
              const rOk = rRes && normTeam(pick.runnerUp, actuals.runnerUp!);
              const oRes = !!actuals.orangeCap;
              const oOk = oRes && normName(pick.orangeCap, actuals.orangeCap!);
              const pRes = !!actuals.purpleCap;
              const pOk = pRes && normName(pick.purpleCap, actuals.purpleCap!);
              return (
                <tr key={pick.owner} className="bg-slate-950/30">
                  <td className="px-3 py-3 align-top">
                    <OwnerBadge owner={pick.owner} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <IplTeamPill code={pick.winner} />
                      <StatusPill resolved={wRes} correct={wOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <IplTeamPill code={pick.runnerUp} />
                      <StatusPill resolved={rRes} correct={rOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-100">{pick.orangeCap}</span>
                      <StatusPill resolved={oRes} correct={oOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-100">{pick.purpleCap}</span>
                      <StatusPill resolved={pRes} correct={pOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right align-top text-lg font-bold tabular-nums text-amber-200">
                    {nCorrect}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
