const DEFAULT_CURRENCY = 'USD';

export function formatCurrency(value: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr ?? '');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

/** For tooltips: short date + optional short time */
export function formatChartTooltipDate(dateStr: string, includeTime = false): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr ?? '');
  return includeTime
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

/** Compact numbers for tooltips: 1.2k, 3.4M */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

/** Format value for chart tooltip: currency, quantity, or compact */
export function formatTooltipValue(
  value: number,
  options: { type: 'currency'; currency?: string } | { type: 'quantity'; unit?: string } | { type: 'number' } = { type: 'number' }
): string {
  if (options.type === 'currency') {
    return formatCurrency(value, options.currency ?? 'USD');
  }
  if (options.type === 'quantity' && options.unit) {
    return `${formatCompactNumber(value)} ${options.unit}`;
  }
  return formatCompactNumber(value);
}
