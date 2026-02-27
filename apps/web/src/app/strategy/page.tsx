import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/common/Button";
import { ModelSelectCard } from "@/components/strategy/ModelSelectCard";
import { ThresholdSlider } from "@/components/strategy/ThresholdSlider";
import { RiskForm } from "@/components/strategy/RiskForm";
import { SessionStats } from "@/components/strategy/SessionStats";

function StrategyWorkspace() {
  return (
    <section className="flex flex-col gap-4 h-full overflow-hidden">
      <div className="flex items-center justify-between pb-2 border-b border-border-dark">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">settings_applications</span>
          策略与风控配置
        </h2>
        <div className="flex gap-3">
          <Button variant="ghost" className="px-4 py-2 text-sm font-medium text-text-muted bg-surface-dark border border-border-dark rounded-lg">
            重置默认
          </Button>
          <Button className="px-4 py-2 text-sm font-bold text-surface-dark rounded-lg shadow-neon">
            <span className="material-symbols-outlined text-[18px]">save</span>
            保存并重启引擎
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto pb-4">
        <div className="flex flex-col gap-6">
          <ModelSelectCard />
          <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
            <div className="p-4 border-b border-border-dark bg-[#1c2128]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">monitoring</span>
                阈值配置
              </h3>
            </div>
            <div className="p-6">
              <ThresholdSlider />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <RiskForm />
        </div>
      </div>

      <SessionStats />
    </section>
  );
}

export default function StrategyPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/strategy" main={<StrategyWorkspace />} />
    </PageTransition>
  );
}
