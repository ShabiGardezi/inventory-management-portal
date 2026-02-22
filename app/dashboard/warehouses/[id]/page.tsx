'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
import { ArrowRight } from 'lucide-react';

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
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

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/warehouses/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/stock/movements?warehouseId=${id}&pageSize=20&sort=createdAt&order=desc`).then((r) =>
        r.ok ? r.json() : { rows: [] }
      ),
    ])
      .then(([w, movementsRes]) => {
        setWarehouse(w ?? null);
        setMovements(movementsRes?.rows ?? []);
      })
      .catch(() => setWarehouse(null))
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

  if (!warehouse) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Warehouse not found.</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/warehouses')}>
          Back to warehouses
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{warehouse.name}</h1>
          <p className="text-muted-foreground">{warehouse.code ?? '—'}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/warehouses">Back to warehouses</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Warehouse details</CardTitle>
          <CardDescription>Address and status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p><span className="font-medium text-muted-foreground">Address</span> {warehouse.address ?? '—'}</p>
          <p><span className="font-medium text-muted-foreground">City</span> {warehouse.city ?? '—'}</p>
          <p><span className="font-medium text-muted-foreground">Country</span> {warehouse.country ?? '—'}</p>
          <p><span className="font-medium text-muted-foreground">Status</span> {warehouse.isActive ? 'Active' : 'Inactive'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Stock movements</CardTitle>
            <CardDescription>Last 20 movements at this warehouse</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/stock?warehouseId=${id}`}>
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No movements at this warehouse.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/dashboard/stock?warehouseId=${id}&movementId=${row.id}`)}
                  >
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(row.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell><Badge variant={TYPE_VARIANT[row.movementType] ?? 'secondary'}>{row.movementType}</Badge></TableCell>
                    <TableCell>{row.product.name} <span className="text-muted-foreground font-mono text-xs">({row.product.sku})</span></TableCell>
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
