import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { ContractTable } from "@/components/dashboard/ContractTable";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { TerminalLogPanel } from "@/components/dashboard/TerminalLogPanel";
import { QuickTradePanel } from "@/components/dashboard/QuickTradePanel";
import { RiskDashboard } from "@/components/dashboard/RiskDashboard";

export default function DashboardPage() {
  return (
    <PageTransition>
      <AppShell
        activeRoute="/dashboard"
        main={
          <>
            <ContractTable />
            <div className="h-1/3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <RecentOrders />
              <TerminalLogPanel />
            </div>
          </>
        }
        right={
          <>
            <QuickTradePanel />
            <RiskDashboard />
          </>
        }
      />
    </PageTransition>
  );
}
