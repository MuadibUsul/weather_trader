import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { WalletManagement } from "@/components/settings/WalletManagement";

export default function WalletPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/wallet" main={<WalletManagement />} />
    </PageTransition>
  );
}
