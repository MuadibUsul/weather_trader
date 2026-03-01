import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { AuditTable } from "@/components/settings/AuditTable";
import { PreferencePanel } from "@/components/settings/PreferencePanel";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { SecurityCard } from "@/components/settings/SecurityCard";

function SettingsWorkspace() {
  return (
    <section className="h-full overflow-y-auto pb-4">
      <div className="w-full max-w-[1240px] mx-auto space-y-4">
        <div className="border-b border-border-dark pb-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">用户设置与安全</h2>
            <p className="text-sm text-text-muted mt-1">管理个人资料、安全策略和系统偏好。</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-10 gap-4 items-start">
          <div className="xl:col-span-3 space-y-4">
            <ProfileCard />
            <PreferencePanel />
          </div>
          <div className="xl:col-span-7 space-y-4">
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
