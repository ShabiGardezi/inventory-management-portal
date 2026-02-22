/**
 * Customer names for sales reference (no Customer table in schema).
 * Used for realistic SO notes or future metadata.
 */
import { randomInt, pickOne } from '../utils';

const COMPANY_PREFIXES = ['Acme', 'Tech', 'Smart', 'Quick', 'Pro', 'Prime', 'Elite', 'First', 'Next', 'Alpha'];
const COMPANY_SUFFIXES = ['Solutions', 'Systems', 'Services', 'Group', 'Labs', 'Works', 'Hub', 'Inc', 'Co'];

export function generateCustomerNames(count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let name: string;
    let attempts = 0;
    do {
      const p = pickOne(COMPANY_PREFIXES);
      const s = pickOne(COMPANY_SUFFIXES);
      const n = randomInt(1, 999);
      name = `${p} ${s} ${n}`;
      attempts++;
    } while (seen.has(name) && attempts < 50);
    seen.add(name);
    out.push(name);
  }
  return out;
}
