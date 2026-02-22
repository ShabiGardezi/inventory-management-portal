'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ScanModal } from './scan-modal';
import { ScanLine } from 'lucide-react';

function hasScanPermission(permissions: string[] | undefined): boolean {
  if (!permissions?.length) return false;
  return permissions.includes('inventory.read') || permissions.includes('inventory:read');
}

export function ScanNavButton() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const permissions = (session?.user as { permissions?: string[] })?.permissions ?? [];

  if (!hasScanPermission(permissions)) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Scan or enter code"
        onClick={() => setOpen(true)}
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <ScanModal open={open} onOpenChange={setOpen} />
    </>
  );
}
