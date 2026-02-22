'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PanelLeftClose, PanelLeft, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NAV_ITEMS } from '@/lib/nav-config';
import { hasAnyPermission } from '@/lib/rbac';

interface AppSidebarProps {
  /** When true, sidebar is in sheet on mobile; when false, we're desktop and use fixed sidebar. */
  isMobile?: boolean;
  /** Controlled collapse for desktop (only used when isMobile is false). */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({
  isMobile = false,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permissions: string[] = session?.user?.permissions ?? [];
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.requiredPermissions.length === 0) return true;
    return hasAnyPermission(permissions, item.requiredPermissions);
  });

  const navContent = (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
      {visibleItems.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const Icon = item.icon;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => isMobile && setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
        if (collapsed) {
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }
        return link;
      })}
    </nav>
  );

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b p-4 pb-2">
            <SheetTitle className="text-left font-semibold">Menu</SheetTitle>
          </SheetHeader>
          {navContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        'hidden flex-col border-r bg-card transition-[width] duration-200 ease-in-out md:flex',
        collapsed ? 'w-[4.5rem]' : 'w-64'
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!collapsed && <span className="truncate text-sm font-semibold">Menu</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
      <TooltipProvider delayDuration={0}>{navContent}</TooltipProvider>
    </aside>
  );
}
