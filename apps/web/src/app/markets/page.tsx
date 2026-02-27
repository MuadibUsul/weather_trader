import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { MarketsView } from "@/components/markets/MarketsView";
import { TradeDrawer } from "@/components/markets/TradeDrawer";

export default function MarketsPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/markets" main={<MarketsView />} right={<TradeDrawer />} mainClassName="gap-0 bg-background-dark" />
    </PageTransition>
  );
}
