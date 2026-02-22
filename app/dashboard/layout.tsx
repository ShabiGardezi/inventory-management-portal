import { AppShell } from '@/components/app-shell';
import { AccessGuard } from '@/components/access-guard';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );
}
