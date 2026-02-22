'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StatCard } from '@/components/dashboard/stat-card';
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
  Package,
  Warehouse,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Truck,
  Activity,
  BarChart3,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type DashboardRange = '7d' | '30d' | '90d' | 'custom';

interface DashboardData {
  summary: {
    totalProducts?: number;
    totalWarehouses?: number;
    totalStockValue?: number;
    lowStockCount?: number;
    todaySalesTotal?: number;
    todayPurchasesTotal?: number;
    todaySalesQuantity?: number;
    todayPurchasesQuantity?: number;
    transfersThisWeek?: number;
    myRecentMovementsCount?: number;
  };
  charts: {
    movementTrend?: { date: string; in: number; out: number }[];
    salesVsPurchases?: { date: string; sales: number; purchases: number }[];
    lowStockByCategory?: { category: string; count: number }[];
    stockByCategory?: { category: string; quantity: number }[];
    myMovementsTrend?: { date: string; count: number }[];
  };
  tables: {
    lowStock?: {
      id: string;
      sku: string;
      name: string;
      category: string | null;
      unit: string;
      price: number | null;
      totalAvailable: number;
    }[];
    recentMovements?: {
      id: string;
      movementType: string;
      quantity: number;
      referenceNumber: string | null;
      createdAt: string;
      productName: string;
      warehouseName: string;
    }[];
    recentSales?: {
      id: string;
      quantity: number;
      referenceNumber: string | null;
      createdAt: string;
      productName: string;
      value: number;
    }[];
    recentPurchases?: {
      id: string;
      quantity: number;
      referenceNumber: string | null;
      createdAt: string;
      productName: string;
      value: number;
    }[];
    auditLogs?: {
      id: string;
      action: string;
      resource: string;
      description: string | null;
      createdAt: string;
      userEmail: string | null;
    }[];
  };
  range: DashboardRange;
  formatSettings?: { currency: string; timezone: string; dateFormat: string };
}

const MOVEMENT_COLORS: Record<string, string> = {
  IN: 'hsl(142, 76%, 36%)',
  OUT: 'hsl(0, 84%, 60%)',
  TRANSFER: 'hsl(217, 91%, 60%)',
  ADJUSTMENT: 'hsl(38, 92%, 50%)',
};

const MOVEMENT_TREND_SERIES = [
  { dataKey: 'in', name: 'In', color: CHART_COLORS[1] },
  { dataKey: 'out', name: 'Out', color: CHART_COLORS[4] },
];
const SALES_VS_PURCHASES_SERIES = [
  { dataKey: 'sales', name: 'Sales', color: CHART_COLORS[4] },
  { dataKey: 'purchases', name: 'Purchases', color: CHART_COLORS[1] },
];
const MY_MOVEMENTS_SERIES = [{ dataKey: 'count', name: 'Movements', color: CHART_COLORS[0] }];

function getDefaultCustomRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movementTrendVisible, setMovementTrendVisible] = useState<Set<string>>(new Set(['in', 'out']));
  const [salesVsPurchasesVisible, setSalesVsPurchasesVisible] = useState<Set<string>>(new Set(['sales', 'purchases']));
  const [myMovementsVisible, setMyMovementsVisible] = useState<Set<string>>(new Set(['count']));

  const fetchUrl =
    range === 'custom' && customFrom && customTo
      ? `/api/dashboard?range=custom&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
      : `/api/dashboard?range=${range}`;
  const shouldFetch = range !== 'custom' || (customFrom !== '' && customTo !== '');

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchUrl, shouldFetch]);

  const handleRangeChange = (r: DashboardRange) => {
    setRange(r);
    if (r === 'custom') {
      const { from, to } = getDefaultCustomRange();
      setCustomFrom(from);
      setCustomTo(to);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your inventory management portal</p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your inventory management portal</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive font-medium">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setError(null);
                setLoading(true);
                const url = range === 'custom' && customFrom && customTo
                  ? `/api/dashboard?range=custom&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`
                  : `/api/dashboard?range=${range}`;
                fetch(url)
                  .then((res) => res.json())
                  .then(setData)
                  .catch(() => setError('Failed to load dashboard'))
                  .finally(() => setLoading(false));
              }}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const s = data?.summary ?? {};
  const charts = data?.charts ?? {};
  const tables = data?.tables ?? {};
  const currency = data?.formatSettings?.currency ?? 'USD';
  const hasAnySummary = Object.keys(s).length > 0;
  const hasAnyChart = Object.keys(charts).length > 0;
  const hasAnyTable = Object.keys(tables).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your inventory management portal</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['7d', '30d', '90d', 'custom'] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleRangeChange(r)}
            >
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : r === '90d' ? '90 days' : 'Custom'}
            </Button>
          ))}
          {range === 'custom' && (
            <>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-36"
                max={customTo || undefined}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-36"
                min={customFrom || undefined}
              />
            </>
          )}
        </div>
      </div>

      {!hasAnySummary && !hasAnyChart && !hasAnyTable && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p>No dashboard data available for your role.</p>
          </CardContent>
        </Card>
      )}

      {hasAnySummary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {s.totalProducts != null && (
            <StatCard title="Total products" value={s.totalProducts} icon={<Package className="h-4 w-4" />} />
          )}
          {s.totalWarehouses != null && (
            <StatCard title="Total warehouses" value={s.totalWarehouses} icon={<Warehouse className="h-4 w-4" />} />
          )}
          {s.totalStockValue != null && (
            <StatCard title="Total stock value" value={formatCurrency(s.totalStockValue, currency)} icon={<DollarSign className="h-4 w-4" />} />
          )}
          {s.lowStockCount != null && (
            <StatCard title="Low stock items" value={s.lowStockCount} icon={<AlertTriangle className="h-4 w-4" />} />
          )}
          {s.todaySalesTotal != null && (
            <StatCard title="Today sales total" value={formatCurrency(s.todaySalesTotal, currency)} icon={<TrendingDown className="h-4 w-4" />} />
          )}
          {s.todayPurchasesTotal != null && (
            <StatCard title="Today purchases total" value={formatCurrency(s.todayPurchasesTotal, currency)} icon={<ShoppingCart className="h-4 w-4" />} />
          )}
          {s.todaySalesQuantity != null && (
            <StatCard title="Today sales (qty)" value={s.todaySalesQuantity} icon={<Activity className="h-4 w-4" />} />
          )}
          {s.transfersThisWeek != null && (
            <StatCard title="Transfers this week" value={s.transfersThisWeek} icon={<Truck className="h-4 w-4" />} />
          )}
          {s.myRecentMovementsCount != null && (
            <StatCard title="My movements (14d)" value={s.myRecentMovementsCount} icon={<Activity className="h-4 w-4" />} />
          )}
        </div>
      )}

      {hasAnyChart && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.movementTrend && charts.movementTrend.length > 0 && (
            <ChartCard
              title="Stock movements (IN vs OUT)"
              subtitle={range === 'custom' && customFrom && customTo ? `${customFrom} to ${customTo}` : `Last ${range}`}
              controls={
                <ChartLegendToggle
                  series={MOVEMENT_TREND_SERIES}
                  visibleKeys={movementTrendVisible}
                  onToggle={(key) => {
                    setMovementTrendVisible((prev) => {
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
                  data={charts.movementTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
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
                        data={(charts.movementTrend ?? []).map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                        labelKey="label"
                        seriesConfig={[
                          { dataKey: 'in', name: 'In', color: CHART_COLORS[1], format: 'number' },
                          { dataKey: 'out', name: 'Out', color: CHART_COLORS[4], format: 'number' },
                        ]}
                        currency={currency}
                      />
                    )}
                  />
                  <Bar dataKey="in" name="In" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} hide={!movementTrendVisible.has('in')} />
                  <Bar dataKey="out" name="Out" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} hide={!movementTrendVisible.has('out')} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.salesVsPurchases && charts.salesVsPurchases.length > 0 && (
            <ChartCard
              title="Sales vs purchases"
              subtitle={range === 'custom' && customFrom && customTo ? `${customFrom} to ${customTo}` : `Last ${range}`}
              controls={
                <ChartLegendToggle
                  series={SALES_VS_PURCHASES_SERIES}
                  visibleKeys={salesVsPurchasesVisible}
                  onToggle={(key) => {
                    setSalesVsPurchasesVisible((prev) => {
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
                  data={charts.salesVsPurchases.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
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
                        data={(charts.salesVsPurchases ?? []).map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                        labelKey="label"
                        seriesConfig={[
                          { dataKey: 'sales', name: 'Sales', color: CHART_COLORS[4], format: 'currency', currency },
                          { dataKey: 'purchases', name: 'Purchases', color: CHART_COLORS[1], format: 'currency', currency },
                        ]}
                        currency={currency}
                      />
                    )}
                  />
                  <Line type="monotone" dataKey="sales" name="Sales" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} hide={!salesVsPurchasesVisible.has('sales')} />
                  <Line type="monotone" dataKey="purchases" name="Purchases" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT_PROPS} hide={!salesVsPurchasesVisible.has('purchases')} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.lowStockByCategory && charts.lowStockByCategory.length > 0 && (
            <ChartCard title="Low stock by category" subtitle="Product count below threshold" chartHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={charts.lowStockByCategory}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="category" width={55} tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    content={(props) => (
                      <ModernTooltip
                        {...props}
                        seriesConfig={[{ dataKey: 'count', name: 'Count', color: CHART_COLORS[0], format: 'number' }]}
                        currency={currency}
                        labelKey="category"
                      />
                    )}
                  />
                  <Bar dataKey="count" name="Count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.stockByCategory && charts.stockByCategory.length > 0 && (
            <ChartCard title="Stock on hand by category" subtitle="Total available quantity" chartHeight={280}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={charts.stockByCategory}
                    dataKey="quantity"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ category, quantity }) => `${category}: ${quantity}`}
                  >
                    {charts.stockByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <ModernTooltip
                        {...props}
                        seriesConfig={[{ dataKey: 'quantity', name: 'Qty', color: CHART_COLORS[0], format: 'number' }]}
                        currency={currency}
                        labelKey="category"
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {charts.myMovementsTrend && charts.myMovementsTrend.length > 0 && (
            <ChartCard
              title="My movements"
              subtitle="Last 14 days"
              controls={
                <ChartLegendToggle
                  series={MY_MOVEMENTS_SERIES}
                  visibleKeys={myMovementsVisible}
                  onToggle={(key) => setMyMovementsVisible((prev) => (prev.has(key) ? new Set() : new Set([key])))}
                />
              }
              chartHeight={280}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={charts.myMovementsTrend.map((d) => ({ ...d, label: formatChartDate(d.date) }))}
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
                        data={(charts.myMovementsTrend ?? []).map((d) => ({ ...d, label: formatChartDate(d.date) }))}
                        labelKey="label"
                        seriesConfig={[{ dataKey: 'count', name: 'Movements', color: CHART_COLORS[0], format: 'number' }]}
                        currency={currency}
                      />
                    )}
                  />
                  <Bar dataKey="count" name="Movements" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} hide={!myMovementsVisible.has('count')} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}

      {hasAnyTable && (
        <div className="grid gap-4 md:grid-cols-2">
          {tables.lowStock && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Low stock products</CardTitle>
                  <CardDescription>Items below threshold</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reports?tab=inventory&lowStockOnly=true">
                    View all <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tables.lowStock.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No low stock products.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.lowStock.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="font-mono text-muted-foreground">{row.sku}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-amber-600 dark:text-amber-400">{row.totalAvailable}</span> {row.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {tables.recentMovements && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Recent stock movements</CardTitle>
                  <CardDescription>Latest activity</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reports?tab=movements&range=30d">
                    View all <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tables.recentMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recent movements.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.recentMovements.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/dashboard/stock?range=30d&movementId=${row.id}`)}
                        >
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell>
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: `${MOVEMENT_COLORS[row.movementType] ?? 'hsl(var(--muted))'}20`,
                                color: MOVEMENT_COLORS[row.movementType] ?? 'inherit',
                              }}
                            >
                              {row.movementType}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {tables.recentSales && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Recent sales</CardTitle>
                  <CardDescription>Latest OUT movements</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reports?tab=sales&range=30d">
                    View all <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tables.recentSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recent sales yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.recentSales.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.value, currency)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {tables.recentPurchases && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Recent purchases</CardTitle>
                  <CardDescription>Latest IN movements</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reports?tab=purchases&range=30d">
                    View all <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tables.recentPurchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No recent purchases yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.recentPurchases.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.value, currency)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {tables.auditLogs && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Latest audit logs</CardTitle>
                  <CardDescription>Recent activity</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reports?tab=audit">
                    View all <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tables.auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No audit logs yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tables.auditLogs.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                              {row.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.resource}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{row.userEmail ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
