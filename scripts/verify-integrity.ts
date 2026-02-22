/**
 * Integrity verification for stock ledger and balances.
 * Run: npm run verify:integrity (or tsx scripts/verify-integrity.ts)
 * Exits with code 1 on any failure.
 *
 * Approval-based execution (receive/confirm/adjust/transfer executed via Approvals)
 * uses the same StockService and produces the same ledger/balance state as direct
 * execution; integrity checks pass after approval flow. See test/approval.integration.test.ts.
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
  process.exit(0);
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
