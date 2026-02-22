'use client';

import * as React from 'react';

/** Recharts passes cursor props (activeCoordinate, offset); we draw a vertical line for crosshair */
export interface ChartCrosshairCursorProps {
  x?: number;
  activeCoordinate?: { x?: number; y?: number };
  offset?: { top?: number; left?: number; width?: number; height?: number };
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

export function ChartCrosshairCursor({
  x: xProp,
  activeCoordinate,
  offset,
  height: heightProp,
  stroke = 'hsl(var(--muted-foreground) / 0.6)',
  strokeWidth = 1,
  strokeDasharray = '4 2',
}: ChartCrosshairCursorProps) {
  const x = xProp ?? activeCoordinate?.x ?? 0;
  const height = heightProp ?? offset?.height ?? 0;
  return (
    <line
      x1={x}
      x2={x}
      y1={0}
      y2={height}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      className="pointer-events-none"
    />
  );
}
