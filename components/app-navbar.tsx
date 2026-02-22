'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileMenu } from '@/components/profile-menu';

const APP_NAME = 'Inventory Portal';

interface AppNavbarProps {
  /** Renders on the left (e.g. mobile sidebar trigger). Shown only on small screens. */
  mobileMenuSlot?: React.ReactNode;
}

export function AppNavbar({ mobileMenuSlot }: AppNavbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex md:hidden">{mobileMenuSlot}</div>
        <Link
        href="/dashboard"
        className="flex items-center gap-2 font-semibold text-foreground md:text-base"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-sm font-bold">{APP_NAME.slice(0, 1)}</span>
        </div>
        <span className="hidden sm:inline-block">{APP_NAME}</span>
      </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <ProfileMenu />
      </div>
    </header>
  );
}
