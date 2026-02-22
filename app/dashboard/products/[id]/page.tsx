'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EditProductDialog, type ProductForEdit } from '@/components/edit-product-dialog';
import { ArrowRight, Pencil } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  price: number | null;
  reorderLevel: number | null;
  isActive: boolean;
}

interface MovementRow {
  id: string;
  movementType: string;
  quantity: string;
  referenceNumber: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  warehouse: { name: string };
}

const TYPE_VARIANT: Record<string, 'success' | 'destructive' | 'secondary' | 'outline'> = {
  IN: 'success',
  OUT: 'destructive',
  TRANSFER: 'secondary',
  ADJUSTMENT: 'outline',
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const canUpdate = (session?.user as { permissions?: string[] })?.permissions?.includes('product:update') ?? false;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/products/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/stock/movements?productId=${id}&pageSize=20&sort=createdAt&order=desc`).then((r) =>
        r.ok ? r.json() : { rows: [] }
      ),
    ])
      .then(([p, movementsRes]) => {
        setProduct(p ?? null);
        setMovements(movementsRes?.rows ?? []);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Product not found.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/products')}>
          Back to products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground font-mono">{product.sku}</p>
        </div>
        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit product
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/dashboard/products">Back to products</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product details</CardTitle>
          <CardDescription>Basic info</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p><span className="font-medium text-muted-foreground">Category</span> {product.category ?? '—'}</p>
          <p><span className="font-medium text-muted-foreground">Unit</span> {product.unit}</p>
          <p><span className="font-medium text-muted-foreground">Price</span> {product.price != null ? `$${Number(product.price).toFixed(2)}` : '—'}</p>
          <p><span className="font-medium text-muted-foreground">Reorder level</span> {product.reorderLevel != null ? product.reorderLevel : '—'}</p>
          <p><span className="font-medium text-muted-foreground">Status</span> {product.isActive ? 'Active' : 'Inactive'}</p>
        </CardContent>
      </Card>

      <EditProductDialog
        product={product as ProductForEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          fetch(`/api/products/${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((p) => p && setProduct(p));
        }}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Stock movements</CardTitle>
            <CardDescription>Last 20 movements for this product</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/stock?productId=${id}`}>
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No movements for this product.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/stock?productId=${id}&movementId=${row.id}`)}
                  >
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(row.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell><Badge variant={TYPE_VARIANT[row.movementType] ?? 'secondary'}>{row.movementType}</Badge></TableCell>
                    <TableCell>{row.warehouse.name}</TableCell>
                    <TableCell className="text-right">{row.movementType === 'OUT' ? `-${row.quantity}` : `+${row.quantity}`}</TableCell>
                    <TableCell className="text-muted-foreground">{row.referenceNumber ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
