import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <ShieldX className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="max-w-sm text-muted-foreground">
        You don&apos;t have permission to view this page. Contact your administrator if you believe
        this is an error.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
