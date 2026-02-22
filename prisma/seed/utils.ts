/**
 * Seeded RNG and helpers for deterministic, realistic demo data.
 * Uses mulberry32 for reproducibility when SEED is set.
 */

let seedState: number;

export function initSeed(seed: number): void {
  seedState = seed >>> 0;
}

/** Returns 0..1 */
function next(): number {
  let t = (seedState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

export function pickMany<T>(arr: readonly T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/**
 * Random date between start and end (inclusive of day).
 * Dates are at 9–17h for realism.
 */
export function randomDateBetween(start: Date, end: Date): Date {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const ms = startMs + next() * (endMs - startMs);
  const d = new Date(ms);
  d.setHours(randomInt(9, 17), randomInt(0, 59), 0, 0);
  return d;
}

/** Round to 2 decimals for money */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Generate unique SKU (e.g. SKU-00001). Index must be unique per run. */
export function skuGenerator(prefix: string, index: number, pad = 5): string {
  return `${prefix}-${String(index).padStart(pad, '0')}`;
}

/** Optional barcode-like string (not stored in current schema but usable in notes/refs) */
export function barcodeGenerator(): string {
  const a = randomInt(100000000000, 999999999999);
  return String(a);
}

/** Shuffle array in place using seed RNG */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
