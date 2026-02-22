import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  ShoppingCart,
  ShoppingBag,
  BarChart3,
  Users,
  Shield,
  FileText,
  Settings,
  ClipboardCheck,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Empty = always visible after login (e.g. Dashboard). Otherwise user must have at least one. */
  requiredPermissions: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, requiredPermissions: [] },
  {
    label: 'Products',
    href: '/dashboard/products',
    icon: Package,
    requiredPermissions: ['product:read', 'inventory:read'],
  },
  {
    label: 'Warehouses',
    href: '/dashboard/warehouses',
    icon: Warehouse,
    requiredPermissions: ['warehouse:read'],
  },
  {
    label: 'Stock Movements',
    href: '/dashboard/stock',
    icon: ArrowLeftRight,
    requiredPermissions: ['inventory:read', 'stock:read'],
  },
  {
    label: 'Purchases',
    href: '/dashboard/purchases',
    icon: ShoppingCart,
    requiredPermissions: ['purchase:read', 'purchase.read'],
  },
  {
    label: 'Sales',
    href: '/dashboard/sales',
    icon: ShoppingBag,
    requiredPermissions: ['sales:read', 'sales.read'],
  },
  {
    label: 'Approvals',
    href: '/dashboard/approvals',
    icon: ClipboardCheck,
    requiredPermissions: ['approvals.read', 'approvals.review'],
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: BarChart3,
    requiredPermissions: ['reports.read', 'reports:read'],
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: Users,
    requiredPermissions: ['users.read', 'user:read'],
  },
  {
    label: 'Roles',
    href: '/dashboard/roles',
    icon: Shield,
    requiredPermissions: ['roles.manage', 'roles.read'],
  },
  {
    label: 'Audit Logs',
    href: '/dashboard/audit',
    icon: FileText,
    requiredPermissions: ['audit.read', 'audit:read'],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    requiredPermissions: ['settings.read'],
  },
];

/** Path -> required permissions (empty array = no permission check). Used for access-denied. */
const PATH_PERMISSIONS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const item of NAV_ITEMS) {
    map[item.href] = item.requiredPermissions;
  }
  return map;
})();

export function getRequiredPermissionsForPath(pathname: string): string[] | null {
  if (pathname in PATH_PERMISSIONS) return PATH_PERMISSIONS[pathname];
  // Nested routes: e.g. /dashboard/products/123 -> use /dashboard/products
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'dashboard') return null;
  const base = `/${segments.slice(0, 2).join('/')}`;
  return base in PATH_PERMISSIONS ? PATH_PERMISSIONS[base] : null;
}
