import { AppShell } from '@/components/app-shell';
import { AccessGuard } from '@/components/access-guard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-snippet': 0,
    },
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );
}
