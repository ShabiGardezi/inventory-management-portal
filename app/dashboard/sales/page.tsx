import { Suspense } from 'react';
import { SalesPageContent } from './sales-content';

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>}>
      <SalesPageContent />
    </Suspense>
  );
}
