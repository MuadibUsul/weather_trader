import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { PreferencePanel } from "@/components/settings/PreferencePanel";
import { SecurityCard } from "@/components/settings/SecurityCard";
import { AuditTable } from "@/components/settings/AuditTable";

function SettingsWorkspace() {
  return (
    <section className="h-full overflow-y-auto pb-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-end justify-between border-b border-border-dark pb-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">用户设置与安全</h2>
            <p className="text-sm text-text-muted mt-1">管理你的个人资料、安全凭证及系统偏好。</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-border-dark hover:bg-surface-dark text-xs text-text-muted hover:text-white transition">
              导出数据
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <ProfileCard />
            <PreferencePanel />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <SecurityCard />
            <AuditTable />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/settings" main={<SettingsWorkspace />} />
    </PageTransition>
  );
}
