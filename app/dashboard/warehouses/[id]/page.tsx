'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, Fragment } from 'react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ArrowRight, ChevronDown, ChevronRight, ListOrdered } from 'lucide-react';

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

interface StockRow {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  onHand: number;
  reorderLevel: number | null;
  value: number;
  lastUpdated: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  trackBatches: boolean;
  trackSerials: boolean;
}

interface SerialItem {
  id: string;
  serialNumber: string;
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
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [serialsDrawer, setSerialsDrawer] = useState<{ productId: string; productName: string; sku: string; batchId?: string } | null>(null);
  const [serials, setSerials] = useState<SerialItem[]>([]);
  const [serialsSearch, setSerialsSearch] = useState('');
  const [serialsStatus, setSerialsStatus] = useState('IN_STOCK');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/warehouses/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/stock/movements?warehouseId=${id}&pageSize=20&sort=createdAt&order=desc`).then((r) =>
        r.ok ? r.json() : { rows: [] }
      ),
      fetch(`/api/warehouses/${id}/stock?limit=500`).then((r) => (r.ok ? r.json() : { rows: [] })),
    ])
      .then(([w, movementsRes, stockRes]) => {
        setWarehouse(w ?? null);
        setMovements(movementsRes?.rows ?? []);
        const rows = (stockRes?.rows ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          lastUpdated: typeof r.lastUpdated === 'string' ? r.lastUpdated : (r.lastUpdated as Date)?.toISOString?.() ?? '',
          expiryDate: r.expiryDate ? (typeof r.expiryDate === 'string' ? r.expiryDate : (r.expiryDate as Date)?.toISOString?.()?.slice(0, 10)) : null,
        }));
        setStockRows(rows);
      })
      .catch(() => setWarehouse(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!serialsDrawer || !id) {
      setSerials([]);
      return;
    }
    const params = new URLSearchParams({
      productId: serialsDrawer.productId,
      warehouseId: id,
      status: serialsStatus,
    });
    if (serialsDrawer.batchId) params.set('batchId', serialsDrawer.batchId);
    fetch(`/api/stock/serials?${params}`)
      .then((r) => (r.ok ? r.json() : { serials: [] }))
      .then((d) => setSerials(d?.serials ?? []))
      .catch(() => setSerials([]));
  }, [serialsDrawer, id, serialsStatus]);

  const stockByProduct = useMemo(() => {
    const byProduct = new Map<string, { product: StockRow; batches: StockRow[] }>();
    for (const row of stockRows) {
      const key = row.productId;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          product: {
            ...row,
            batchId: null,
            batchNumber: null,
            expiryDate: null,
            onHand: row.batchId ? 0 : row.onHand,
            value: row.batchId ? 0 : row.value,
          },
          batches: [],
        });
      }
      const entry = byProduct.get(key)!;
      if (row.batchId) {
        entry.batches.push(row);
      } else {
        entry.product.onHand = row.onHand;
        entry.product.value = row.value;
        entry.product.lastUpdated = row.lastUpdated;
        entry.product.trackBatches = row.trackBatches;
        entry.product.trackSerials = row.trackSerials;
        entry.product.productName = row.productName;
        entry.product.sku = row.sku;
        entry.product.category = row.category;
        entry.product.reorderLevel = row.reorderLevel;
      }
    }
    for (const entry of byProduct.values()) {
      if (entry.batches.length > 0) {
        entry.product.onHand = entry.batches.reduce((s, b) => s + b.onHand, 0);
        entry.product.value = entry.batches.reduce((s, b) => s + b.value, 0);
      }
    }
    return Array.from(byProduct.entries()).map(([productId, v]) => ({ productId, ...v }));
  }, [stockRows]);

  const filteredSerials = useMemo(() => {
    if (!serialsSearch.trim()) return serials;
    const q = serialsSearch.trim().toLowerCase();
    return serials.filter((s) => s.serialNumber.toLowerCase().includes(q));
  }, [serials, serialsSearch]);

  const toggleExpanded = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

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
        <CardHeader>
          <CardTitle>Stock by product</CardTitle>
          <CardDescription>Expand batch-tracked products to see batch breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {stockByProduct.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No stock at this warehouse.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockByProduct.map(({ productId, product, batches }) => {
                  const isExpanded = expandedProducts.has(productId);
                  const hasBatches = batches.length > 0;
                  return (
                    <Fragment key={productId}>
                      <TableRow>
                        <TableCell className="w-8">
                          {hasBatches ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpanded(productId)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/products/${productId}`} className="font-medium text-primary hover:underline">
                            {product.productName}
                          </Link>
                          <span className="text-muted-foreground font-mono text-xs ml-1">({product.sku})</span>
                        </TableCell>
                        <TableCell className="text-right">{product.onHand}</TableCell>
                        <TableCell className="text-right">${product.value.toFixed(2)}</TableCell>
                        <TableCell>
                          {product.trackSerials && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSerialsDrawer({ productId, productName: product.productName, sku: product.sku })}
                            >
                              <ListOrdered className="h-4 w-4 mr-1" />
                              View serials
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {hasBatches && isExpanded &&
                        batches.map((b) => (
                          <TableRow key={b.batchId!} className="bg-muted/30">
                            <TableCell className="w-8" />
                            <TableCell className="pl-8 font-mono text-sm">
                              {b.batchNumber}
                              {b.expiryDate && <span className="text-muted-foreground ml-2">(exp: {b.expiryDate})</span>}
                            </TableCell>
                            <TableCell className="text-right">{b.onHand}</TableCell>
                            <TableCell className="text-right">${b.value.toFixed(2)}</TableCell>
                            <TableCell>
                              {product.trackSerials && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSerialsDrawer({ productId, productName: product.productName, sku: product.sku, batchId: b.batchId! })}
                                >
                                  View serials
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
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

      <Sheet open={!!serialsDrawer} onOpenChange={(o) => !o && setSerialsDrawer(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Serials</SheetTitle>
            <SheetDescription>
              {serialsDrawer ? `${serialsDrawer.productName} (${serialsDrawer.sku})` : ''} — searchable list
            </SheetDescription>
          </SheetHeader>
          {serialsDrawer && (
            <div className="mt-6 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search serial..."
                  value={serialsSearch}
                  onChange={(e) => setSerialsSearch(e.target.value)}
                />
                <select
                  value={serialsStatus}
                  onChange={(e) => setSerialsStatus(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="IN_STOCK">IN_STOCK</option>
                  <option value="SOLD">SOLD</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="RETURNED">RETURNED</option>
                </select>
              </div>
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                {filteredSerials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No serials found.</p>
                ) : (
                  filteredSerials.map((s) => (
                    <div key={s.id} className="font-mono text-sm py-1 border-b border-border/50">
                      {s.serialNumber}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
