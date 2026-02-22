import { Suspense } from 'react';
import { PurchasesPageContent } from './purchases-content';

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>}>
      <PurchasesPageContent />
    </Suspense>
  );
}
