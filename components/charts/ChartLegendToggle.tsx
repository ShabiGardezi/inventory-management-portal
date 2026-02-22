'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SeriesConfig {
  dataKey: string;
  name: string;
  color: string;
}

export interface ChartLegendToggleProps {
  series: SeriesConfig[];
  /** Keys that are currently visible (shown on chart) */
  visibleKeys: Set<string>;
  onToggle: (dataKey: string) => void;
  className?: string;
}

export function ChartLegendToggle({
  series,
  visibleKeys,
  onToggle,
  className,
}: ChartLegendToggleProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 text-xs', className)}
      role="list"
      aria-label="Chart series legend"
    >
      {series.map(({ dataKey, name, color }) => {
        const isVisible = visibleKeys.has(dataKey);
        return (
          <button
            key={dataKey}
            type="button"
            onClick={() => onToggle(dataKey)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted/80',
              !isVisible && 'opacity-50'
            )}
            role="listitem"
            aria-pressed={isVisible}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
              style={{ backgroundColor: isVisible ? color : 'transparent' }}
              aria-hidden
            />
            <span className="text-muted-foreground">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
