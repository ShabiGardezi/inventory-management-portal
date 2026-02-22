'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  TrendingUp,
  Settings,
  Users,
} from 'lucide-react';

const navigation: { name: string; href: string; icon: typeof LayoutDashboard; permission?: string; permissionAny?: string[] }[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/dashboard/products', icon: Package },
  { name: 'Warehouses', href: '/dashboard/warehouses', icon: Warehouse, permission: 'warehouse:read' },
  { name: 'Stock Movements', href: '/dashboard/stock', icon: TrendingUp },
  { name: 'Users', href: '/dashboard/users', icon: Users, permissionAny: ['users.read', 'user:read'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permissions: string[] = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];

  const visibleNav = navigation.filter((item) => {
    if (item.permission) return permissions.includes(item.permission);
    if (item.permissionAny?.length) return item.permissionAny.some((p) => permissions.includes(p));
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Inventory Portal</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
