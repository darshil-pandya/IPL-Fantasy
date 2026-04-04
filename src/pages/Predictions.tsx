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
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-300">
        Pending
      </span>
    );
  }
  if (correct) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-400/60">
        Match
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-300">
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

  const selectClass = "app-input min-w-[8rem] py-2 text-sm";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold uppercase tracking-wide text-brand-dark">
          Predictions
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Each correct prediction wins <strong className="text-brand-ocean">{pts} pts</strong>.
          Bonus flows into the leaderboard. Picks are stored in{" "}
          <code className="rounded bg-brand-pale px-1 text-brand-dark">predictions.json</code>. Season results can be
          saved in this browser or pasted into <code className="rounded bg-brand-pale px-1 text-brand-dark">actuals</code>{" "}
          for everyone.
        </p>
      </div>

      <section className="app-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-dark/50">
          Season results (moderator)
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
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
          <button type="button" className="app-btn-secondary" onClick={() => {
            void navigator.clipboard.writeText(exportActualsJson(actuals));
          }}>
            Copy actuals JSON
          </button>
          <button
            type="button"
            className="app-btn-secondary"
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
          <div key={c.label} className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/50">
              {c.label}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold text-brand-dark">
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

      <div className="app-table">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="app-table-head border-b border-brand-cyan/50">
            <tr>
              <th className="px-3 py-3 font-medium">Franchise</th>
              <th className="px-3 py-3 font-medium">Winner pick</th>
              <th className="px-3 py-3 font-medium">Runner-up pick</th>
              <th className="px-3 py-3 font-medium">Orange Cap pick</th>
              <th className="px-3 py-3 font-medium">Purple Cap pick</th>
              <th className="px-3 py-3 text-right font-medium">Correct</th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={pick.owner} className="app-table-row">
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
                      <span className="text-brand-dark">{pick.orangeCap}</span>
                      <StatusPill resolved={oRes} correct={oOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-brand-dark">{pick.purpleCap}</span>
                      <StatusPill resolved={pRes} correct={pOk} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right align-top text-lg font-bold tabular-nums text-brand-ocean">
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
