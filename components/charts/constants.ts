/** Shared chart colors (HSL) for consistency and dark-mode friendly */
export const CHART_COLORS = [
  'hsl(217, 91%, 60%)',   // blue
  'hsl(142, 76%, 36%)',   // green
  'hsl(38, 92%, 50%)',    // amber
  'hsl(280, 67%, 47%)',   // purple
  'hsl(0, 84%, 60%)',     // red
] as const;

export const CHART_COLORS_MOVEMENT: Record<string, string> = {
  IN: 'hsl(142, 76%, 36%)',
  OUT: 'hsl(0, 84%, 60%)',
  TRANSFER: 'hsl(217, 91%, 60%)',
  ADJUSTMENT: 'hsl(38, 92%, 50%)',
};

/** Recharts activeDot with glow for line/area charts */
export const ACTIVE_DOT_PROPS = {
  r: 6,
  strokeWidth: 2,
  stroke: 'hsl(var(--background))',
  fill: 'inherit',
  style: { filter: 'drop-shadow(0 0 4px currentColor)' },
} as const;
