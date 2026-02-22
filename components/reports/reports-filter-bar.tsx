'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom' },
] as const;

export interface ReportsFilterBarProps {
  warehouses: { id: string; name: string; code: string | null }[];
  categories: string[];
  showWarehouse?: boolean;
  searchParams: URLSearchParams;
  onApply: (params: Record<string, string>) => void;
}

export function ReportsFilterBar({
  warehouses,
  categories,
  showWarehouse = true,
  searchParams,
  onApply,
}: ReportsFilterBarProps) {
  const range = searchParams.get('range') ?? '30d';
  const warehouseId = searchParams.get('warehouseId') ?? '';
  const category = searchParams.get('category') ?? searchParams.get('categoryId') ?? '';
  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';
  const [customFrom, setCustomFrom] = useState(fromParam);
  const [customTo, setCustomTo] = useState(toParam);

  const buildParams = useCallback(
    (overrides: Record<string, string> = {}) => {
      const p = new URLSearchParams(searchParams);
      Object.entries(overrides).forEach(([k, v]) => {
        if (v === '' || v === 'all') {
          p.delete(k);
          if (k === 'category') p.delete('categoryId');
        } else {
          p.set(k, v);
          if (k === 'category') p.set('categoryId', v);
        }
      });
      return Object.fromEntries(p.entries());
    },
    [searchParams]
  );

  const handleApply = useCallback(() => {
    if (range === 'custom') {
      onApply(buildParams({ from: customFrom, to: customTo }));
    } else {
      onApply(buildParams({}));
    }
  }, [range, customFrom, customTo, buildParams, onApply]);

  const handleReset = useCallback(() => {
    setCustomFrom('');
    setCustomTo('');
    onApply({ range: '30d' });
  }, [onApply]);

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Date range</Label>
          <Select
            value={range}
            onValueChange={(v) => {
              const next = buildParams({ range: v });
              if (v !== 'custom') {
                delete next.from;
                delete next.to;
              }
              onApply(next);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {range === 'custom' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="reports-from" className="text-xs">From</Label>
              <Input
                id="reports-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reports-to" className="text-xs">To</Label>
              <Input
                id="reports-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[140px]"
              />
            </div>
          </>
        )}
        {showWarehouse && (
          <div className="space-y-1.5">
            <Label className="text-xs">Warehouse</Label>
            <Select
              value={warehouseId || 'all'}
              onValueChange={(v) => onApply(buildParams({ warehouseId: v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <Select
            value={category || 'all'}
            onValueChange={(v) => onApply(buildParams({ category: v, categoryId: v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {range === 'custom' && (
          <Button size="sm" onClick={handleApply}>Apply</Button>
        )}
        <Button size="sm" variant="outline" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}
