"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/common/Button";
import { ApiError, runWeatherPaperBacktest, type WeatherPaperReportDto } from "@/lib/api";

type MatchingModel = "depth" | "mid";
type PaperModel = "deterministic_l2" | "stochastic_impact" | "both";

type FormState = {
  marketLimit: number;
  initialCash: number;
  feeRate: number;
  slippageBps: number;
  matchingModel: MatchingModel;
  paperModel: PaperModel;
  seed: number;
  edgeThreshold: number;
  orderNotional: number;
};

const DEFAULT_FORM: FormState = {
  marketLimit: 6,
  initialCash: 10000,
  feeRate: 0.001,
  slippageBps: 10,
  matchingModel: "depth",
  paperModel: "deterministic_l2",
  seed: 42,
  edgeThreshold: 0.03,
  orderNotional: 150,
};

function fmtNumber(value: number, digits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function fmtPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${fmtNumber(value, digits)}%`;
}

function toShortJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseAuditLines(report?: WeatherPaperReportDto) {
  if (!report?.auditJsonl) {
    return [];
  }
  return report.auditJsonl
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function WeatherPaperLab() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: FormState) =>
      runWeatherPaperBacktest({
        marketLimit: payload.marketLimit,
        initialCash: payload.initialCash,
        feeRate: payload.feeRate,
        slippageBps: payload.slippageBps,
        matchingModel: payload.matchingModel,
        paperModel: payload.paperModel,
        seed: payload.seed,
        edgeThreshold: payload.edgeThreshold,
        orderNotional: payload.orderNotional,
      }),
    onSuccess: () => {
      setLastRunAt(new Date().toLocaleString("zh-CN"));
    },
  });

  const result = mutation.data;
  const auditLines = useMemo(() => parseAuditLines(result), [result]);
  const auditPreview = auditLines.slice(-8);

  const topMarkets = useMemo(() => {
    if (!result) {
      return [];
    }
    return [...result.report.decomposition.byMarket]
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [result]);

  const errorMessage = useMemo(() => {
    if (!mutation.error) {
      return null;
    }
    if (mutation.error instanceof ApiError) {
      return `${mutation.error.code} (HTTP ${mutation.error.status})`;
    }
    return mutation.error.message;
  }, [mutation.error]);

  return (
    <section className="rounded-xl border border-border-dark bg-surface-dark p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white">Official Paper Lab</h3>
        <p className="text-xs text-text-muted mt-1">Run official Polymarket weather data in paper loop.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Matching Model</span>
          <select
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            value={form.matchingModel}
            onChange={(event) => setForm((prev) => ({ ...prev, matchingModel: event.target.value as MatchingModel }))}
          >
            <option value="depth">depth</option>
            <option value="mid">mid</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Paper Model</span>
          <select
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            value={form.paperModel}
            onChange={(event) => setForm((prev) => ({ ...prev, paperModel: event.target.value as PaperModel }))}
          >
            <option value="deterministic_l2">deterministic_l2</option>
            <option value="stochastic_impact">stochastic_impact</option>
            <option value="both">both</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Seed</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={1}
            value={form.seed}
            onChange={(event) => setForm((prev) => ({ ...prev, seed: Number(event.target.value) || 1 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Market Limit</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={1}
            max={30}
            value={form.marketLimit}
            onChange={(event) => setForm((prev) => ({ ...prev, marketLimit: Number(event.target.value) || 1 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Initial Cash</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={100}
            step={100}
            value={form.initialCash}
            onChange={(event) => setForm((prev) => ({ ...prev, initialCash: Number(event.target.value) || 100 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Fee Rate</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={0}
            max={0.05}
            step={0.0005}
            value={form.feeRate}
            onChange={(event) => setForm((prev) => ({ ...prev, feeRate: Number(event.target.value) || 0 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Slippage (bps)</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={0}
            max={500}
            value={form.slippageBps}
            onChange={(event) => setForm((prev) => ({ ...prev, slippageBps: Number(event.target.value) || 0 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Edge Threshold</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={0}
            max={1}
            step={0.005}
            value={form.edgeThreshold}
            onChange={(event) => setForm((prev) => ({ ...prev, edgeThreshold: Number(event.target.value) || 0 }))}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-text-muted">Order Notional</span>
          <input
            className="w-full h-8 rounded-lg border border-border-dark bg-background-dark px-2 text-xs text-white"
            type="number"
            min={10}
            step={10}
            value={form.orderNotional}
            onChange={(event) => setForm((prev) => ({ ...prev, orderNotional: Number(event.target.value) || 10 }))}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="min-w-28">
          {mutation.isPending ? "Running..." : "Run Official Paper"}
        </Button>
        <Button variant="secondary" onClick={() => setForm(DEFAULT_FORM)} disabled={mutation.isPending}>
          Reset Defaults
        </Button>
        {lastRunAt ? <span className="text-xs text-text-muted">Last run: {lastRunAt}</span> : null}
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 p-3 text-xs text-accent-error">
          Backtest failed: {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Total Return</div>
              <div
                className={`text-sm font-bold mt-1 ${
                  result.report.tradingMetrics.totalReturn >= 0 ? "text-primary" : "text-accent-error"
                }`}
              >
                {fmtPercent(result.report.tradingMetrics.totalReturn, 3)}
              </div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Max Drawdown</div>
              <div className="text-sm font-bold mt-1 text-white">{fmtPercent(result.report.tradingMetrics.maxDrawdownPct, 3)}</div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Brier Score</div>
              <div className="text-sm font-bold mt-1 text-white">{fmtNumber(result.report.forecastMetrics.brierScore, 4)}</div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Fills / Orders</div>
              <div className="text-sm font-bold mt-1 text-white">
                {result.report.summary.totalFills} / {result.report.summary.totalOrders}
              </div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Settled PnL</div>
              <div
                className={`text-sm font-bold mt-1 ${
                  result.snapshot.ledger.settledPnl >= 0 ? "text-primary" : "text-accent-error"
                }`}
              >
                {fmtNumber(result.snapshot.ledger.settledPnl, 2)}
              </div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Real Eligibility</div>
              <div
                className={`text-sm font-bold mt-1 ${
                  result.realEligibility.eligibleForReal ? "text-primary" : "text-accent-warning"
                }`}
              >
                {result.realEligibility.eligibleForReal ? "PASS" : "BLOCKED"}
              </div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <div className="text-[11px] text-text-muted">Model Variant</div>
              <div className="text-sm font-bold mt-1 text-white">{result.modelVariant ?? "deterministic_l2"}</div>
            </div>
          </div>

          {result.sensitivityDelta ? (
            <div className="rounded-lg border border-border-dark bg-background-dark p-3 text-xs text-text-muted flex flex-wrap gap-4">
              <span>
                sensitivity totalReturnDelta: <span className="text-white">{fmtNumber(result.sensitivityDelta.totalReturnDelta, 4)}</span>
              </span>
              <span>
                sensitivity brierDelta: <span className="text-white">{fmtNumber(result.sensitivityDelta.brierDelta, 4)}</span>
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <h4 className="text-xs font-semibold text-white">Real Gate Checks</h4>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {Object.entries(result.realEligibility.checks).map(([key, pass]) => (
                  <div key={key} className="flex items-center justify-between rounded border border-border-dark px-2 py-1">
                    <span className="text-text-muted">{key}</span>
                    <span className={pass ? "text-primary" : "text-accent-error"}>{pass ? "PASS" : "FAIL"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <h4 className="text-xs font-semibold text-white">Top Market PnL</h4>
              <div className="mt-2 space-y-1">
                {topMarkets.length === 0 ? (
                  <div className="text-xs text-text-muted">No market decomposition data</div>
                ) : (
                  topMarkets.map((row) => (
                    <div key={row.key} className="flex items-center justify-between text-xs border border-border-dark rounded px-2 py-1">
                      <span className="text-text-muted truncate max-w-[70%]" title={row.key}>
                        {row.key}
                      </span>
                      <span className={row.pnl >= 0 ? "text-primary" : "text-accent-error"}>
                        {row.pnl >= 0 ? "+" : ""}
                        {fmtNumber(row.pnl, 2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <h4 className="text-xs font-semibold text-white">Audit Preview (latest 8 events)</h4>
              <pre className="mt-2 text-[11px] leading-5 text-text-muted whitespace-pre-wrap max-h-48 overflow-auto">
                {auditPreview.length > 0 ? auditPreview.join("\n") : "No audit events"}
              </pre>
            </div>
            <div className="rounded-lg border border-border-dark bg-background-dark p-3">
              <h4 className="text-xs font-semibold text-white">Execution + Source Meta</h4>
              <pre className="mt-2 text-[11px] leading-5 text-text-muted whitespace-pre-wrap max-h-48 overflow-auto">
                {toShortJson({
                  executionConfig: result.executionConfig,
                  sourceMeta: result.sourceMeta,
                })}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
