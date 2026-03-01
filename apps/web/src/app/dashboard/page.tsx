"use client";

import { useState } from "react";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { EquityChart } from "@/components/dashboard/EquityChart";
import { ExposurePanel } from "@/components/dashboard/ExposurePanel";
import { HealthPanel } from "@/components/dashboard/HealthPanel";
import { StrategyLeaderboard } from "@/components/dashboard/StrategyLeaderboard";
import { TopSignals } from "@/components/dashboard/TopSignals";
import { WeatherPaperLab } from "@/components/dashboard/WeatherPaperLab";
import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";

type Range = "1D" | "7D" | "30D" | "ALL";

export default function DashboardPage() {
  const [range, setRange] = useState<Range>("7D");
  const ranges: Range[] = ["1D", "7D", "30D", "ALL"];

  return (
    <PageTransition>
      <AppShell
        activeRoute="/dashboard"
        main={
          <section className="h-full overflow-y-auto space-y-3 pr-1">
            <div className="rounded-xl border border-border-dark bg-surface-dark p-3 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-base">策略盈利驱动控制台</h2>
                <p className="text-xs text-text-muted mt-1">一眼回答：最赚钱策略、风险是否可控、是否该扩缩仓。</p>
              </div>
              <div className="inline-flex border border-border-dark rounded-lg overflow-hidden">
                {ranges.map((item) => (
                  <button
                    key={item}
                    onClick={() => setRange(item)}
                    className={`h-8 px-3 text-xs ${
                      range === item ? "bg-primary/15 text-primary" : "text-text-muted hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <WeatherPaperLab />
            <DashboardSummary range={range} />
            <EquityChart range={range} />
            <StrategyLeaderboard range={range} />
            <ExposurePanel range={range} />
            <HealthPanel range={range} />
          </section>
        }
        right={<TopSignals />}
      />
    </PageTransition>
  );
}
