'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getRequiredPermissionsForPath } from '@/lib/nav-config';
import { hasAnyPermission } from '@/lib/rbac';

export function AccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const required = getRequiredPermissionsForPath(pathname ?? '');

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (required === null || required.length === 0) return;
    const permissions: string[] = session.user.permissions ?? [];
    if (!hasAnyPermission(permissions, required)) {
      router.replace('/dashboard/access-denied');
    }
  }, [status, session?.user, required, router]);

  if (status === 'loading') return null;
  if (status !== 'authenticated' || !session?.user) return <>{children}</>;
  if (required === null || required.length === 0) return <>{children}</>;
  const permissions: string[] = session.user.permissions ?? [];
  if (!hasAnyPermission(permissions, required)) return null;
  return <>{children}</>;
}
