/**
 * Shared safety gates for db-reset, db-seed, and db-refresh.
 * Scripts MUST pass all gates before modifying the database.
 */

import type { PrismaClient } from '@prisma/client';

const REQUIRED_ENV = {
  ALLOW_DB_RESET: 'YES_DELETE_ALL',
  CONFIRM_RESET_TEXT: 'DELETE_DATABASE_NOW',
  BACKUP_CONFIRMED: 'YES',
} as const;

const PROD_ENV = 'ALLOW_PROD_RESET';
const PROD_ENV_VALUE = 'I_UNDERSTAND_THIS_IS_DESTRUCTIVE';

export interface SafetyGateResult {
  ok: boolean;
  error?: string;
}

async function fetchGlobalSettingsId(prisma: PrismaClient): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM settings
    WHERE scope = 'GLOBAL'
      AND "tenantId" IS NULL
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function fetchResetSafetyFlags(
  prisma: PrismaClient
): Promise<{ systemLockdown: boolean; allowProdWipe: boolean } | null> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ systemLockdown: boolean | null; allowProdWipe: boolean | null }>
    >`
      SELECT "systemLockdown", "allowProdWipe"
      FROM settings
      WHERE scope = 'GLOBAL'
        AND "tenantId" IS NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return { systemLockdown: false, allowProdWipe: false };
    return {
      systemLockdown: row.systemLockdown === true,
      allowProdWipe: row.allowProdWipe === true,
    };
  } catch {
    // Columns may not exist yet if Prisma schema changes weren't pushed to DB.
    return null;
  }
}

/** Parse DATABASE_URL for host and database name (no secrets). */
export function parseDatabaseUrl(): { host: string; database: string } {
  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== 'string') {
    return { host: 'unknown', database: 'unknown' };
  }
  try {
    const u = new URL(url);
    const db = u.pathname ? u.pathname.replace(/^\//, '').replace(/\?.*$/, '') : 'unknown';
    return { host: u.hostname || 'unknown', database: db || 'unknown' };
  } catch {
    return { host: 'unknown', database: 'unknown' };
  }
}

/** Check required env vars; in production also require ALLOW_PROD_RESET. */
export function checkEnvGates(): SafetyGateResult {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    if (process.env[key] !== value) {
      return {
        ok: false,
        error: `Missing or invalid env: ${key} must equal "${value}". Current: ${process.env[key] ?? '(unset)'}.`,
      };
    }
  }
  if (process.env.NODE_ENV === 'production') {
    if (process.env[PROD_ENV] !== PROD_ENV_VALUE) {
      return {
        ok: false,
        error: `Production requires ${PROD_ENV}="${PROD_ENV_VALUE}".`,
      };
    }
  }
  return { ok: true };
}

export interface LockdownGateOptions {
  /** If true, allow when no Settings row exists (e.g. seed right after reset). */
  allowMissingSettings?: boolean;
}

/** Check Settings: systemLockdown or allowProdWipe must be true. */
export async function checkLockdownGate(
  prisma: PrismaClient,
  options: LockdownGateOptions = {}
): Promise<SafetyGateResult> {
  const id = await fetchGlobalSettingsId(prisma);
  if (!id) {
    if (options.allowMissingSettings) return { ok: true };
    return {
      ok: false,
      error:
        'Database lockdown gate failed: no GLOBAL Settings row. Create Settings with systemLockdown=true or allowProdWipe=true (e.g. after first seed).',
    };
  }
  const flags = await fetchResetSafetyFlags(prisma);
  if (!flags) {
    return {
      ok: false,
      error:
        'Database lockdown gate failed: Settings.systemLockdown/allowProdWipe columns are missing in the database. Apply schema changes (e.g. `npx prisma db push`) and try again.',
    };
  }
  const lockdown = flags.systemLockdown === true;
  const allowWipe = flags.allowProdWipe === true;
  if (!lockdown && !allowWipe) {
    return {
      ok: false,
      error:
        'Database lockdown gate failed: Settings.systemLockdown and Settings.allowProdWipe are not true. Set at least one to true to allow reset/seed.',
    };
  }
  return { ok: true };
}

/** Production-only: refuse unless nonAdminUsersCount === 0 or <=1 (only admin) OR allowProdWipe is true. */
export async function checkEmptyUsageGate(prisma: PrismaClient): Promise<SafetyGateResult> {
  if (process.env.NODE_ENV !== 'production') return { ok: true };

  const [userCount, adminRoleId] = await Promise.all([
    prisma.user.count(),
    prisma.role.findUnique({ where: { name: 'admin' }, select: { id: true } }),
  ]);

  const id = await fetchGlobalSettingsId(prisma);
  if (id) {
    const flags = await fetchResetSafetyFlags(prisma);
    if (!flags) {
      return {
        ok: false,
        error:
          'Production "empty usage" gate failed: Settings.allowProdWipe column is missing in the database. Apply schema changes (e.g. `npx prisma db push`).',
      };
    }
    if (flags.allowProdWipe === true) {
      return { ok: true };
    }
  }

  if (userCount === 0) return { ok: true };
  if (adminRoleId) {
    const adminUserCount = await prisma.userRole.count({
      where: { roleId: adminRoleId.id },
    });
    const nonAdminCount = userCount - adminUserCount;
    if (nonAdminCount <= 0 && userCount <= 1) return { ok: true };
    if (nonAdminCount > 0) {
      return {
        ok: false,
        error: `Production "empty usage" gate failed: ${userCount} users (${nonAdminCount} non-admin). Set Settings.allowProdWipe=true to override, or ensure only one admin exists.`,
      };
    }
  }
  return { ok: true };
}

/** Interactive: print DB info and require operator to type exact DB name to proceed. */
export function buildHumanVerificationPrompt(): {
  message: string;
  expectedDbName: string;
} {
  const { host, database } = parseDatabaseUrl();
  const message = [
    'Human verification: you are about to run a DESTRUCTIVE operation.',
    'Database connection:',
    `  current_database() → run SELECT current_database(); to confirm`,
    `  current_user    → run SELECT current_user; to confirm`,
    `  DATABASE_URL    → host: ${host}, database: ${database}`,
    '',
    `Type the exact database name to proceed: "${database}"`,
  ].join('\n');
  return { message, expectedDbName: database };
}

/** Run human verification using readline (sync not available in Node for stdin). */
export async function runHumanVerification(): Promise<SafetyGateResult> {
  const { message, expectedDbName } = buildHumanVerificationPrompt();
  console.log(message);

  const readline = await import('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();
      const trimmed = (answer ?? '').trim();
      if (trimmed !== expectedDbName) {
        resolve({
          ok: false,
          error: `Verification failed: expected "${expectedDbName}", got "${trimmed}".`,
        });
      } else {
        resolve({ ok: true });
      }
    });
  });
}

export interface RunSafetyGatesOptions {
  /** Allow missing Settings (for db-seed after a full reset). */
  allowMissingSettings?: boolean;
}

/** Run all safety gates (env, lockdown, empty-usage for prod). Does NOT run human verification (caller does that). */
export async function runSafetyGates(
  prisma: PrismaClient,
  options: RunSafetyGatesOptions = {}
): Promise<SafetyGateResult> {
  const env = checkEnvGates();
  if (!env.ok) return env;

  const lockdown = await checkLockdownGate(prisma, {
    allowMissingSettings: options.allowMissingSettings,
  });
  if (!lockdown.ok) return lockdown;

  const emptyUsage = await checkEmptyUsageGate(prisma);
  if (!emptyUsage.ok) return emptyUsage;

  return { ok: true };
}
