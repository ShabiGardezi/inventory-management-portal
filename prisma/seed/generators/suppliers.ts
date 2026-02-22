/**
 * Supplier names for purchase reference (no Supplier table in schema).
 * Used to generate realistic PO notes or future metadata.
 */
import { randomInt, pickOne } from '../utils';

const PREFIXES = ['Global', 'Prime', 'Elite', 'United', 'National', 'Metro', 'City', 'Central', 'Pacific', 'Atlantic'];
const TYPES = ['Supplies', 'Distribution', 'Wholesale', 'Trading', 'Goods', 'Materials', 'Logistics'];
const SUFFIXES = ['Co', 'Inc', 'Ltd', 'LLC', 'Corp'];

export function generateSupplierNames(count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    let attempts = 0;
    do {
      const p = pickOne(PREFIXES);
      const t = pickOne(TYPES);
      const s = pickOne(SUFFIXES);
      const n = randomInt(1, 99);
      name = `${p} ${t} ${s} #${n}`;
      attempts++;
    } while (seen.has(name) && attempts < 50);
    seen.add(name);
    out.push(name);
  }
  return out;
}
