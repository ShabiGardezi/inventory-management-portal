/**
 * Integrity verification for stock ledger and balances.
 * Run: npm run verify:integrity (or tsx scripts/verify-integrity.ts)
 * Exits with code 1 on any failure.
 */

import { prisma } from '@/lib/prisma';
import { runIntegrityChecks } from '@/lib/verify-integrity';

async function main(): Promise<void> {
  const { ok, errors } = await runIntegrityChecks(prisma);
  if (!ok) {
    console.error('Integrity check FAILED:\n');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log('Integrity check passed: balances match ledger, transfers valid, no invalid negative balances.');
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
