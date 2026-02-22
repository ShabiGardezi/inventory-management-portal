'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Optional controls (e.g. compare toggle) rendered in header */
  controls?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Min height for consistent chart area; helps avoid layout shift */
  chartHeight?: number;
}

export function ChartCard({
  title,
  subtitle,
  controls,
  children,
  className,
  chartHeight = 280,
}: ChartCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 pb-2">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle && (
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          )}
        </div>
        {controls && <div className="flex items-center gap-2">{controls}</div>}
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ minHeight: chartHeight }}>{children}</div>
      </CardContent>
    </Card>
  );
}
