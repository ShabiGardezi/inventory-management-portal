import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AccessGuard } from '@/components/access-guard';

export const metadata: Metadata = {
  title: 'Admin',
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

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );
}

