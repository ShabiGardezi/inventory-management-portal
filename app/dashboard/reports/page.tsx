'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ReportsFilterBar } from '@/components/reports/reports-filter-bar';
import {
  BarChart3,
  Package,
  ArrowLeftRight,
  ShoppingBag,
  ShoppingCart,
  FileText,
  LayoutDashboard,
  AlertTriangle,
  Download,
  ExternalLink,
} from 'lucide-react';
import { formatCurrency, formatDate, formatChartDate } from '@/lib/format';
import {
  ChartCard,
  ChartLegendToggle,
  ModernTooltip,
  ChartCrosshairCursor,
  CHART_COLORS,
  ACTIVE_DOT_PROPS,
} from '@/components/charts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { hasAnyPermission } from '@/lib/rbac';

const TAB_OVERVIEW = 'overview';
const TAB_INVENTORY = 'inventory';
const TAB_MOVEMENTS = 'movements';
const TAB_SALES = 'sales';
const TAB_PURCHASES = 'purchases';
const TAB_AUDIT = 'audit';

const PERM_REPORTS = ['reports.read', 'reports:read'];
const PERM_WAREHOUSE = ['warehouse.read', 'warehouse:read'];
const PERM_SALES = ['sales.read', 'sales:read'];
const PERM_PURCHASE = ['purchase.read', 'purchase:read'];
const PERM_AUDIT = ['audit.read', 'audit:read'];
const PERM_EXPORT = ['export.read', 'reports.read', 'reports:read'];
const PERM_INVENTORY = ['inventory.read', 'inventory:read', 'reports.read', 'reports:read'];

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[280px] w-full rounded-lg" />
      <Skeleton className="h-[200px] w-full rounded-lg" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium">{message}</p>
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];

  const tab = searchParams.get('tab') ?? TAB_OVERVIEW;
  const [filters, setFilters] = useState<{ warehouses: { id: string; name: string; code: string | null }[]; categories: string[] }>({
    warehouses: [],
    categories: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);

  const showWarehouse = hasAnyPermission(permissions, PERM_WAREHOUSE);
  const showSales = hasAnyPermission(permissions, PERM_SALES);
  const showPurchases = hasAnyPermission(permissions, PERM_PURCHASE);
  const showAudit = hasAnyPermission(permissions, PERM_AUDIT);
  const canExport = hasAnyPermission(permissions, PERM_EXPORT);

  const setQuery = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v === '' || v === 'all') next.delete(k);
        else next.set(k, v);
      });
      router.replace(`/dashboard/reports?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setFiltersLoading(true);
    setFiltersError(null);
    fetch('/api/reports/filters')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load filters');
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setFilters({ warehouses: d.warehouses ?? [], categories: d.categories ?? [] });
      })
      .catch((e) => {
        if (!cancelled) setFiltersError(e instanceof Error ? e.message : 'Failed to load filters');
      })
      .finally(() => {
        if (!cancelled) setFiltersLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Operations and management insights</p>
      </div>

      {!filtersLoading && !filtersError && (
        <ReportsFilterBar
          warehouses={filters.warehouses}
          categories={filters.categories}
          showWarehouse={showWarehouse}
          searchParams={searchParams}
          onApply={setQuery}
        />
      )}
      {filtersError && (
        <ErrorState
          message={filtersError}
          onRetry={() => {
            setFiltersError(null);
            setFiltersLoading(true);
            fetch('/api/reports/filters')
              .then((r) => r.json())
              .then((d) => setFilters({ warehouses: d.warehouses ?? [], categories: d.categories ?? [] }))
              .catch(() => setFiltersError('Failed to load filters'))
              .finally(() => setFiltersLoading(false));
          }}
        />
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setQuery({ tab: v })}
        className="w-full"
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value={TAB_OVERVIEW}>
            <LayoutDashboard className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value={TAB_INVENTORY}>
            <Package className="h-4 w-4 mr-1.5" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value={TAB_MOVEMENTS}>
            <ArrowLeftRight className="h-4 w-4 mr-1.5" />
            Movements
          </TabsTrigger>
          {showSales && (
            <TabsTrigger value={TAB_SALES}>
              <ShoppingBag className="h-4 w-4 mr-1.5" />
              Sales
            </TabsTrigger>
          )}
          {showPurchases && (
            <TabsTrigger value={TAB_PURCHASES}>
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Purchases
            </TabsTrigger>
          )}
          {showAudit && (
            <TabsTrigger value={TAB_AUDIT}>
              <FileText className="h-4 w-4 mr-1.5" />
              Audit
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={TAB_OVERVIEW} className="mt-4">
          <ReportsOverviewTab
            searchParams={searchParams}
            canExport={canExport}
            currency="USD"
          />
        </TabsContent>
        <TabsContent value={TAB_INVENTORY} className="mt-4">
          <ReportsInventoryTab
            searchParams={searchParams}
            canExport={canExport}
            currency="USD"
            onQueryChange={setQuery}
          />
        </TabsContent>
        <TabsContent value={TAB_MOVEMENTS} className="mt-4">
          <ReportsMovementsTab
            searchParams={searchParams}
            canExport={canExport}
            onQueryChange={setQuery}
          />
        </TabsContent>
        {showSales && (
          <TabsContent value={TAB_SALES} className="mt-4">
            <ReportsSalesTab
              searchParams={searchParams}
              canExport={canExport}
              currency="USD"
            />
          </TabsContent>
        )}
        {showPurchases && (
          <TabsContent value={TAB_PURCHASES} className="mt-4">
            <ReportsPurchasesTab
              searchParams={searchParams}
              canExport={canExport}
              currency="USD"
            />
          </TabsContent>
        )}
        {showAudit && (
          <TabsContent value={TAB_AUDIT} className="mt-4">
            <ReportsAuditTab
              searchParams={searchParams}
              canExport={canExport}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const OVERVIEW_SALES_VS_PURCHASES_SERIES = [
  { dataKey: 'sales', name: 'Sales', color: CHART_COLORS[4] },
  { dataKey: 'purchases', name: 'Purchases', color: CHART_COLORS[1] },
];
const OVERVIEW_MOVEMENT_SERIES = [
  { dataKey: 'in', name: 'IN', color: CHART_COLORS[1] },
  { dataKey: 'out', name: 'OUT', color: CHART_COLORS[4] },
];

// --- Overview tab
function ReportsOverviewTab({
  searchParams,
  canExport,
  currency,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
  currency: string;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewSalesPurchasesVisible, setOverviewSalesPurchasesVisible] = useState<Set<string>>(new Set(['sales', 'purchases']));
  const [overviewMovementVisible, setOverviewMovementVisible] = useState<Set<string>>(new Set(['in', 'out']));

  const qs = searchParams.toString();

  const fetchOverview = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/overview?${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load overview');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading && !data) return <ReportsSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchOverview} />;

  const totalStockValue = data?.totalStockValue as number | undefined;
  const lowStockCount = data?.lowStockCount as number | undefined;
  const totalSales = data?.totalSales as number | undefined;
  const totalPurchases = data?.totalPurchases as number | undefined;
  const netMovement = data?.netMovement as number | undefined;
  const salesVsPurchasesTrend = (data?.salesVsPurchasesTrend as { date: string; sales: number; purchases: number }[]) ?? [];
  const movementTrend = (data?.movementTrend as { date: string; in: number; out: number }[]) ?? [];
  const stockValueByWarehouse = (data?.stockValueByWarehouse as { warehouseName: string; value: number }[]) ?? [];
  const stockValueByCategory = (data?.stockValueByCategory as { category: string; value: number }[]) ?? [];
  const topMovedProducts = (data?.topMovedProducts as { productName: string; sku: string; totalQty: number }[]) ?? [];
  const lowStockProducts = (data?.lowStockProducts as { name: string; sku: string; category: string | null; totalAvailable: number }[]) ?? [];
  const topSellingProducts = (data?.topSellingProducts as { productName: string; sku: string; quantity: number; value: number }[]) ?? [];

  const hasAny = [
    totalStockValue,
    lowStockCount,
    totalSales,
    totalPurchases,
    netMovement,
    salesVsPurchasesTrend.length,
    movementTrend.length,
    stockValueByWarehouse.length,
    stockValueByCategory.length,
    topMovedProducts.length,
    lowStockProducts.length,
    topSellingProducts.length,
  ].some((x) => x !== undefined && x !== 0);

  if (!hasAny) return <EmptyState message="No data for selected range and filters." />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {totalStockValue != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalStockValue, currency)}</div>
            </CardContent>
          </Card>
        )}
        {lowStockCount != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockCount}</div>
            </CardContent>
          </Card>
        )}
        {totalSales != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales (range)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSales, currency)}</div>
            </CardContent>
          </Card>
        )}
        {totalPurchases != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases (range)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPurchases, currency)}</div>
            </CardContent>
          </Card>
        )}
        {netMovement != null && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net Movement (IN − OUT)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(netMovement, currency)}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {salesVsPurchasesTrend.length > 0 && (
          <ChartCard
            title="Sales vs Purchases"
            subtitle="Trend for selected range"
            controls={
              <ChartLegendToggle
                series={OVERVIEW_SALES_VS_PURCHASES_SERIES}
                visibleKeys={overviewSalesPurchasesVisible}
                onToggle={(key) => {
                  setOverviewSalesPurchasesVisible((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next.size ? next : new Set(['sales', 'purchases']);
                  });
                }}
              />
            }
            chartHeight={280}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={salesVsPurchasesTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(Number(v), currency)} />
                <Tooltip
                  cursor={<ChartCrosshairCursor />}
                  content={(props) => (
                    <ModernTooltip
                      {...props}
                      data={salesVsPurchasesTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                      labelKey="label"
                      seriesConfig={[
                        { dataKey: 'sales', name: 'Sales', color: CHART_COLORS[4], format: 'currency', currency },
                        { dataKey: 'purchases', name: 'Purchases', color: CHART_COLORS[1], format: 'currency', currency },
                      ]}
                      currency={currency}
                    />
                  )}
                />
                <Line type="monotone" dataKey="sales" name="Sales" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} hide={!overviewSalesPurchasesVisible.has('sales')} />
                <Line type="monotone" dataKey="purchases" name="Purchases" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} hide={!overviewSalesPurchasesVisible.has('purchases')} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        {movementTrend.length > 0 && (
          <ChartCard
            title="IN vs OUT movements"
            subtitle="Quantity trend"
            controls={
              <ChartLegendToggle
                series={OVERVIEW_MOVEMENT_SERIES}
                visibleKeys={overviewMovementVisible}
                onToggle={(key) => {
                  setOverviewMovementVisible((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next.size ? next : new Set(['in', 'out']);
                  });
                }}
              />
            }
            chartHeight={280}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={movementTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={<ChartCrosshairCursor />}
                  content={(props) => (
                    <ModernTooltip
                      {...props}
                      data={movementTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                      labelKey="label"
                      seriesConfig={[
                        { dataKey: 'in', name: 'IN', color: CHART_COLORS[1], format: 'number' },
                        { dataKey: 'out', name: 'OUT', color: CHART_COLORS[4], format: 'number' },
                      ]}
                      currency={currency}
                    />
                  )}
                />
                <Bar dataKey="in" name="IN" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} hide={!overviewMovementVisible.has('in')} />
                <Bar dataKey="out" name="OUT" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} hide={!overviewMovementVisible.has('out')} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {(stockValueByWarehouse.length > 0 || stockValueByCategory.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {stockValueByWarehouse.length > 0 && (
            <ChartCard title="Stock value by warehouse" subtitle="Value by location" chartHeight={260}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stockValueByWarehouse.map((d) => ({ ...d, label: d.warehouseName }))}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v), currency)} />
                  <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    content={(props) => (
                      <ModernTooltip
                        {...props}
                        seriesConfig={[{ dataKey: 'value', name: 'Value', color: CHART_COLORS[0], format: 'currency', currency }]}
                        currency={currency}
                        labelKey="label"
                      />
                    )}
                  />
                  <Bar dataKey="value" name="Value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
          {stockValueByCategory.length > 0 && (
            <ChartCard title="Stock value by category" subtitle="Value by category" chartHeight={260}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={stockValueByCategory.map((d) => ({ ...d, label: d.category }))}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(Number(v), currency)} />
                  <Tooltip
                    cursor={<ChartCrosshairCursor />}
                    content={(props) => (
                      <ModernTooltip
                        {...props}
                        data={stockValueByCategory.map((d) => ({ ...d, label: d.category }))}
                        labelKey="label"
                        seriesConfig={[{ dataKey: 'value', name: 'Value', color: CHART_COLORS[2], format: 'currency', currency }]}
                        currency={currency}
                      />
                    )}
                  />
                  <Bar dataKey="value" name="Value" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {topMovedProducts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top moved products</CardTitle>
              <Link href={`/dashboard/reports?tab=movements&${searchParams.toString()}`}>
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topMovedProducts.slice(0, 5).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell className="text-right">{p.totalQty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Low stock</CardTitle>
              <Link href={`/dashboard/reports?tab=inventory&lowStockOnly=true&${searchParams.toString()}`}>
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.slice(0, 5).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category ?? '—'}</TableCell>
                      <TableCell className="text-right">{p.totalAvailable}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        {topSellingProducts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Top selling products</CardTitle>
              <Link href={`/dashboard/reports?tab=sales&${searchParams.toString()}`}>
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSellingProducts.slice(0, 5).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-right">{p.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.value, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// --- Inventory tab
function ReportsInventoryTab({
  searchParams,
  canExport,
  currency,
  onQueryChange,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
  currency: string;
  onQueryChange: (params: Record<string, string>) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<{ rows: unknown[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const q = searchParams.get('q') ?? '';
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    params.set('pageSize', '20');
    if (q) params.set('q', q);
    if (lowStockOnly) params.set('lowStockOnly', 'true');
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/inventory?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load inventory');
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData({ rows: d.rows ?? [], pagination: d.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [searchParams.toString(), page, q, lowStockOnly]);

  const handleSearchApply = () => {
    const qVal = (document.getElementById('inv-q') as HTMLInputElement | null)?.value?.trim() ?? '';
    const lowEl = document.getElementById('inv-low') as HTMLInputElement | null;
    const low = lowEl?.checked ?? false;
    const params: Record<string, string> = { page: '1', tab: 'inventory', q: qVal, lowStockOnly: low ? 'true' : '' };
    onQueryChange(params);
  };

  const handleExport = () => {
    const p = new URLSearchParams(searchParams);
    if (q) p.set('q', q);
    if (lowStockOnly) p.set('lowStockOnly', 'true');
    window.open(`/api/reports/inventory/export?${p.toString()}`, '_blank');
  };

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  const rows = (data?.rows ?? []) as {
    productId: string;
    sku: string;
    name: string;
    category: string | null;
    warehouseName: string;
    onHand: number;
    reorderLevel: number | null;
    unitCost: number | null;
    stockValue: number;
    isLowStock: boolean;
  }[];
  const pagination = data?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="inv-q"
          type="search"
          placeholder="Search by name or SKU..."
          defaultValue={q}
          className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            id="inv-low"
            type="checkbox"
            defaultChecked={lowStockOnly}
          />
          Low stock only
        </label>
        <Button size="sm" onClick={handleSearchApply}>Apply</Button>
        {canExport && (
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>
      {loading && !data ? (
        <ReportsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState message="No inventory for selected filters." />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reorder</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.productId}-${r.warehouseName}`}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.sku}</TableCell>
                    <TableCell>{r.category ?? '—'}</TableCell>
                    <TableCell>{r.warehouseName}</TableCell>
                    <TableCell className="text-right">{r.onHand}</TableCell>
                    <TableCell className="text-right">{r.reorderLevel ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.unitCost != null ? formatCurrency(r.unitCost, currency) : '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.stockValue, currency)}</TableCell>
                    <TableCell>
                      {r.isLowStock ? <Badge variant="destructive">Low stock</Badge> : <Badge variant="secondary">OK</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set('tab', 'inventory');
                  p.set('page', String(pagination.page - 1));
                  router.replace(`/dashboard/reports?${p.toString()}`, { scroll: false });
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set('tab', 'inventory');
                  p.set('page', String(pagination.page + 1));
                  router.replace(`/dashboard/reports?${p.toString()}`, { scroll: false });
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Movements tab
function ReportsMovementsTab({
  searchParams,
  canExport,
  onQueryChange,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
  onQueryChange: (params: Record<string, string>) => void;
}) {
  const [data, setData] = useState<{ rows: unknown[]; pagination: { page: number; total: number; totalPages: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    params.set('pageSize', '20');
    let cancelled = false;
    setLoading(true);
    fetch(`/api/reports/movements?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load movements');
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData({ rows: d.rows ?? [], pagination: d.pagination ?? { page: 1, total: 0, totalPages: 1 } });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [searchParams.toString(), page]);

  const rows = (data?.rows ?? []) as {
    id: string;
    movementType: string;
    quantity: string;
    referenceNumber: string | null;
    createdAt: string;
    product: { name: string; sku: string };
    warehouse: { name: string };
    createdBy: { email: string; name: string | null } | null;
  }[];
  const pagination = data?.pagination ?? { page: 1, total: 0, totalPages: 1 };

  const typeVariant = (t: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (t === 'IN') return 'default';
    if (t === 'OUT') return 'destructive';
    if (t === 'TRANSFER') return 'secondary';
    return 'outline';
  };

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  return (
    <div className="space-y-4">
      {canExport && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/movements/export?${searchParams.toString()}`, '_blank')}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      )}
      {loading && !data ? (
        <ReportsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState message="No movements for selected range." />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Performed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell><Badge variant={typeVariant(r.movementType)}>{r.movementType}</Badge></TableCell>
                    <TableCell>{r.product.name} ({r.product.sku})</TableCell>
                    <TableCell>{r.warehouse.name}</TableCell>
                    <TableCell className="text-right">{r.movementType === 'OUT' ? `-${r.quantity}` : r.quantity}</TableCell>
                    <TableCell>{r.referenceNumber ?? '—'}</TableCell>
                    <TableCell>{r.createdBy?.email ?? r.createdBy?.name ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => onQueryChange({ tab: 'movements', page: String(pagination.page - 1) })}>Previous</Button>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => onQueryChange({ tab: 'movements', page: String(pagination.page + 1) })}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Sales tab
function ReportsSalesTab({
  searchParams,
  canExport,
  currency,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
  currency: string;
}) {
  const [data, setData] = useState<{
    totals?: { totalAmount: number; orderCount: number; avgOrderValue: number };
    trend?: { date: string; sales: number }[];
    topProducts?: { productName: string; quantity: number; value: number }[];
    rows: unknown[];
    pagination: { page: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    params.set('pageSize', '20');
    fetch(`/api/reports/sales?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load sales');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [searchParams.toString(), page]);

  const totals = data?.totals;
  const trend = data?.trend ?? [];
  const topProducts = data?.topProducts ?? [];
  const rows = (data?.rows ?? []) as { date: string; referenceNumber: string | null; total: number; status: string; createdByEmail: string | null }[];
  const pagination = data?.pagination ?? { page: 1, total: 0, totalPages: 1 };

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;
  if (loading && !data) return <ReportsSkeleton />;

  return (
    <div className="space-y-6">
      {totals && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalAmount, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.orderCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg order value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.avgOrderValue, currency)}</div>
            </CardContent>
          </Card>
        </div>
      )}
      {trend.length > 0 && (
        <ChartCard title="Sales trend" subtitle="Daily sales value" chartHeight={260}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.map((d) => ({ ...d, label: formatChartDate(d.date) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => formatCurrency(Number(v), currency)} />
              <Tooltip
                cursor={<ChartCrosshairCursor />}
                content={(props) => (
                  <ModernTooltip
                    {...props}
                    data={trend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                    labelKey="label"
                    seriesConfig={[{ dataKey: 'sales', name: 'Sales', color: CHART_COLORS[4], format: 'currency', currency }]}
                    currency={currency}
                  />
                )}
              />
              <Line type="monotone" dataKey="sales" name="Sales" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {topProducts.length > 0 && (
        <ChartCard title="Top selling products" subtitle="By sales value" chartHeight={260}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProducts.slice(0, 8).map((p, i) => ({ name: p.productName, value: p.value, fill: CHART_COLORS[i % CHART_COLORS.length] }))} margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v), currency)} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                content={(props) => (
                  <ModernTooltip
                    {...props}
                    seriesConfig={[{ dataKey: 'value', name: 'Sales', color: CHART_COLORS[4], format: 'currency', currency }]}
                    currency={currency}
                    labelKey="name"
                  />
                )}
              />
              <Bar dataKey="value" name="Sales" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/sales?${searchParams.toString()}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View Sales
          </Button>
        </Link>
        {canExport && (
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/sales/export?${searchParams.toString()}`, '_blank')}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>
      {rows.length === 0 && !totals ? (
        <EmptyState message="No sales for selected range." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice/Order</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell>{r.referenceNumber ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.total, currency)}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.createdByEmail ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pagination.totalPages > 1 && (
            <div className="flex justify-between p-4">
              <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}>Previous</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Purchases tab
function ReportsPurchasesTab({
  searchParams,
  canExport,
  currency,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
  currency: string;
}) {
  const [data, setData] = useState<{
    totals?: { totalAmount: number; orderCount: number };
    trend?: { date: string; purchases: number }[];
    byWarehouse?: { warehouseName: string; total: number }[];
    rows: unknown[];
    pagination: { page: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    params.set('pageSize', '20');
    fetch(`/api/reports/purchases?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load purchases');
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [searchParams.toString(), page]);

  const totals = data?.totals;
  const trend = data?.trend ?? [];
  const byWarehouse = data?.byWarehouse ?? [];
  const rows = (data?.rows ?? []) as { date: string; referenceNumber: string | null; total: number; status: string; createdByEmail: string | null }[];
  const pagination = data?.pagination ?? { page: 1, total: 0, totalPages: 1 };

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;
  if (loading && !data) return <ReportsSkeleton />;

  return (
    <div className="space-y-6">
      {totals && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalAmount, currency)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.orderCount}</div>
            </CardContent>
          </Card>
        </div>
      )}
      {trend.length > 0 && (
        <ChartCard title="Purchases trend" subtitle="Daily purchases value" chartHeight={260}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.map((d) => ({ ...d, label: formatChartDate(d.date) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => formatCurrency(Number(v), currency)} />
              <Tooltip
                cursor={<ChartCrosshairCursor />}
                content={(props) => (
                  <ModernTooltip
                    {...props}
                    data={trend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                    labelKey="label"
                    seriesConfig={[{ dataKey: 'purchases', name: 'Purchases', color: CHART_COLORS[1], format: 'currency', currency }]}
                    currency={currency}
                  />
                )}
              />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {byWarehouse.length > 0 && (
        <ChartCard title="Purchases by warehouse" subtitle="Total by location" chartHeight={240}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byWarehouse} margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v), currency)} />
              <YAxis type="category" dataKey="warehouseName" width={100} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                content={(props) => (
                  <ModernTooltip
                    {...props}
                    seriesConfig={[{ dataKey: 'total', name: 'Total', color: CHART_COLORS[0], format: 'currency', currency }]}
                    currency={currency}
                    labelKey="warehouseName"
                  />
                )}
              />
              <Bar dataKey="total" name="Total" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/purchases?${searchParams.toString()}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View Purchases
          </Button>
        </Link>
        {canExport && (
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/purchases/export?${searchParams.toString()}`, '_blank')}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>
      {rows.length === 0 && !totals ? (
        <EmptyState message="No purchases for selected range." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>PO No</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell>{r.referenceNumber ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.total, currency)}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.createdByEmail ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pagination.totalPages > 1 && (
            <div className="flex justify-between p-4">
              <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}>Previous</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// --- Audit tab
function ReportsAuditTab({
  searchParams,
  canExport,
}: {
  searchParams: URLSearchParams;
  canExport: boolean;
}) {
  const [data, setData] = useState<{ rows: unknown[]; pagination: { page: number; total: number; totalPages: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    params.set('pageSize', '20');
    fetch(`/api/reports/audit?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load audit');
        return res.json();
      })
      .then((d) => {
        setData({ rows: d.rows ?? [], pagination: d.pagination ?? { page: 1, total: 0, totalPages: 1 } });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [searchParams.toString(), page]);

  const rows = (data?.rows ?? []) as { date: string; actorEmail: string | null; action: string; resource: string; resourceId: string | null; metadataSummary: string | null }[];
  const pagination = data?.pagination ?? { page: 1, total: 0, totalPages: 1 };

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;
  if (loading && !data) return <ReportsSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Link href={`/dashboard/audit?${searchParams.toString()}`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            Full audit log
          </Button>
        </Link>
        {canExport && (
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/reports/audit/export?${searchParams.toString()}`, '_blank')}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState message="No audit entries for selected range." />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.actorEmail ?? '—'}</TableCell>
                    <TableCell><Badge variant="secondary">{r.action}</Badge></TableCell>
                    <TableCell>{r.resource}</TableCell>
                    <TableCell>{r.resourceId ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.metadataSummary ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {pagination.totalPages > 1 && (
            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1}>Previous</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
