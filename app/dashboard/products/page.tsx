'use client';

import { useState, Suspense } from 'react';
import { ProductsTable } from '@/components/products-table';
import { CreateProductDialog } from '@/components/create-product-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProductsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

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
        <CreateProductDialog onSuccess={handleProductCreated}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </CreateProductDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>
            View and manage all products in your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading products…</div>}>
            <ProductsTable key={refreshKey} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
