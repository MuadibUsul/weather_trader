import { AppShell } from "@/components/layout/AppShell";
import { PageTransition } from "@/components/layout/PageTransition";
import { CredentialManagement } from "@/components/settings/CredentialManagement";

export default function CredentialsPage() {
  return (
    <PageTransition>
      <AppShell activeRoute="/credentials" main={<CredentialManagement />} />
    </PageTransition>
  );
}
