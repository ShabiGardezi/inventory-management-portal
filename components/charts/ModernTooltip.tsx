'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatChartTooltipDate, formatCurrency, formatCompactNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ValueFormatter = (value: number, dataKey: string) => string;

export interface TooltipSeriesConfig {
  dataKey: string;
  name: string;
  color: string;
  /** 'currency' | 'quantity' | 'number'; currency uses system currency */
  format?: 'currency' | 'quantity' | 'number';
  unit?: string;
  currency?: string;
}

/** Recharts tooltip payload item (compatible with Payload<ValueType, NameType>) */
export interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  dataKey?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface ModernTooltipProps {
  active?: boolean;
  /** Recharts passes Payload<ValueType, NameType>[]; we accept unknown[] and narrow internally */
  payload?: ReadonlyArray<unknown>;
  label?: string;
  /** Full chart data array for computing previous point / delta */
  data?: ReadonlyArray<Record<string, unknown>>;
  /** Label key in payload (e.g. 'date' or 'label') for date display */
  labelKey?: string;
  /** Series config for display order and formatting */
  seriesConfig?: ReadonlyArray<TooltipSeriesConfig>;
  /** System currency for currency formatting */
  currency?: string;
  /** Custom formatter per dataKey; overrides seriesConfig format */
  valueFormatters?: Partial<Record<string, ValueFormatter>>;
  className?: string;
}

function formatValue(
  value: number,
  dataKey: string,
  config: TooltipSeriesConfig | undefined,
  currency: string,
  custom?: ValueFormatter
): string {
  if (custom) return custom(value, dataKey);
  if (config?.format === 'currency') return formatCurrency(value, config.currency ?? currency);
  if (config?.format === 'quantity' && config.unit) return `${formatCompactNumber(value)} ${config.unit}`;
  return formatCompactNumber(value);
}

export function ModernTooltip({
  active,
  payload,
  label,
  data = [],
  labelKey = 'date',
  seriesConfig = [],
  currency = 'USD',
  valueFormatters,
  className,
}: ModernTooltipProps) {
  if (!active || !payload?.length) return null;

  const first = payload[0] as TooltipPayloadItem | undefined;
  const row = first?.payload as Record<string, unknown> | undefined;
  const dateRaw = row?.[labelKey] ?? row?.date ?? label;
  const dateStr = typeof dateRaw === 'string' ? dateRaw : '';
  const displayDate = dateStr ? formatChartTooltipDate(dateStr) : (typeof label === 'string' ? label : '—');

  const configMap = React.useMemo(() => {
    const m = new Map<string, TooltipSeriesConfig>();
    seriesConfig.forEach((s) => m.set(s.dataKey, s));
    return m;
  }, [seriesConfig]);

  const prevRow = React.useMemo(() => {
    if (!dateStr || !data.length) return undefined;
    const idx = data.findIndex((d) => (d[labelKey] ?? d.date) === dateStr);
    if (idx <= 0) return undefined;
    return data[idx - 1] as Record<string, unknown>;
  }, [data, dateStr, labelKey]);

  return (
    <Card
      className={cn(
        'pointer-events-none z-50 border shadow-lg',
        'max-w-[280px]',
        className
      )}
    >
      <CardHeader className="pb-1.5 pt-3 px-3">
        <p className="text-xs font-medium text-muted-foreground">{displayDate}</p>
      </CardHeader>
      <CardContent className="pt-0 px-3 pb-3 space-y-2">
        {(payload as TooltipPayloadItem[]).map((entry, idx) => {
          const dataKey = String(entry.dataKey ?? idx);
          const config = configMap.get(dataKey);
          const rawValue = entry.value;
          const value = Number(Array.isArray(rawValue) ? rawValue[0] : rawValue ?? 0);
          const formatted = formatValue(
            value,
            dataKey,
            config,
            currency,
            valueFormatters?.[dataKey]
          );
          const prevValue = prevRow ? Number(prevRow[dataKey]) : undefined;
          const delta =
            prevValue !== undefined && !Number.isNaN(prevValue)
              ? value - prevValue
              : undefined;
          const pct =
            delta !== undefined && prevValue !== undefined && prevValue !== 0
              ? ((delta / Math.abs(prevValue)) * 100).toFixed(1)
              : undefined;
          const seriesName = entry.name != null ? String(entry.name) : dataKey;

          return (
            <div
              key={dataKey}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: entry.color ?? 'hsl(var(--muted))' }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{seriesName}</span>
              </div>
              <div className="flex items-end gap-2 tabular-nums">
                <span className="font-medium">{formatted}</span>
                {delta !== undefined && (
                  <span
                    className={cn(
                      'text-xs',
                      delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {config?.format === 'currency'
                      ? formatCurrency(delta, config.currency ?? currency)
                      : delta}
                    {pct != null && ` (${pct}%)`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
