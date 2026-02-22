'use client';

import { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { ProductsTable } from '@/components/products-table';
import { CreateProductDialog } from '@/components/create-product-dialog';
import { ProductImportModal } from '@/components/products/product-import-modal';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProductsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const { data: session } = useSession();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canImport = permissions.includes('product:import') || permissions.includes('product:create');

  const handleProductCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product inventory
          </p>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          )}
          <CreateProductDialog onSuccess={handleProductCreated}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </CreateProductDialog>
        </div>
      </div>

      <ProductImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleProductCreated}
      />

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>
            View and manage all products in your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading products…</div>}>
            <ProductsTable key={refreshKey} refreshTrigger={refreshKey} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
