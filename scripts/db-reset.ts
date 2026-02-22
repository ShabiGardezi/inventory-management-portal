/**
 * Production-safe DB reset: truncates all application tables (FK-safe with CASCADE).
 * Uses DIRECT_URL when set to avoid pooler connection drops.
 * Refuses to run unless all safety gates pass. CLI-only.
 *
 * Required env: ALLOW_DB_RESET, CONFIRM_RESET_TEXT, BACKUP_CONFIRMED; production also ALLOW_PROD_RESET.
 * Settings: systemLockdown or allowProdWipe must be true.
 * Usage: npx tsx scripts/db-reset.ts [--yes]
 */

import 'dotenv/config';
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { PrismaClient } from '@prisma/client';
import {
  runSafetyGates,
  runHumanVerification,
  parseDatabaseUrl,
} from './safety-gates';

const prisma = new PrismaClient();

const SKIP_VERIFICATION = process.argv.includes('--yes');

async function getApplicationTableNames(): Promise<string[]> {
  const rows = await prisma.$queryRaw<
    Array<{ table_name: string }>
  >`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

async function getRowCounts(
  tableNames: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of tableNames) {
    try {
      const quoted = table === table.toLowerCase() ? table : `"${table}"`;
      const result = await prisma.$queryRawUnsafe<
        Array<{ count: bigint }>
      >(`SELECT COUNT(*)::bigint as count FROM ${quoted}`);
      const n = result[0]?.count ?? BigInt(0);
      counts.set(table, Number(n));
    } catch {
      counts.set(table, 0);
    }
  }
  return counts;
}

async function truncateAll(tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  const quoted = tables.map((t) => (t === t.toLowerCase() ? t : `"${t}"`));
  const list = quoted.join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`
  );
}

async function main(): Promise<void> {
  console.log('db-reset: checking safety gates...\n');

  const gates = await runSafetyGates(prisma);
  if (!gates.ok) {
    console.error('Safety gate failed:', gates.error);
    process.exit(1);
  }

  if (!SKIP_VERIFICATION) {
    const verification = await runHumanVerification();
    if (!verification.ok) {
      console.error(verification.error);
      process.exit(1);
    }
    console.log('Verification passed.\n');
  } else {
    console.log('Skipping human verification (--yes).\n');
  }

  const tableNames = await getApplicationTableNames();
  if (tableNames.length === 0) {
    console.log('No application tables found. Nothing to truncate.');
    return;
  }

  const beforeCounts = await getRowCounts(tableNames);
  console.log('Row counts before truncate:');
  for (const name of tableNames) {
    const n = beforeCounts.get(name) ?? 0;
    if (n > 0) console.log(`  ${name}: ${n}`);
  }

  await truncateAll(tableNames);
  console.log('\nTruncate completed.');

  const afterCounts = await getRowCounts(tableNames);
  console.log('Row counts after truncate:');
  for (const name of tableNames) {
    console.log(`  ${name}: ${afterCounts.get(name) ?? 0}`);
  }

  const { database } = parseDatabaseUrl();
  console.log(`\nDatabase "${database}" has been reset. Run db:seed to repopulate.`);
}

main()
  .catch((err) => {
    console.error('db-reset error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
