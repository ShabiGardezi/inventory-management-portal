/**
 * Runs db-reset then db-seed with the same safety gates. Prints final summary.
 * Usage: npx tsx scripts/db-refresh.ts [--yes]
 *
 * Env: same as db-reset and db-seed (ALLOW_DB_RESET, CONFIRM_RESET_TEXT, BACKUP_CONFIRMED, etc.).
 */

import { execSync } from 'node:child_process';

const rootDir = process.cwd();

function run(name: string, args: string[]): void {
  const cmd = `npx tsx scripts/${name} ${args.join(' ')}`.trim();
  console.log('\n>>>', cmd, '\n');
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env },
  });
}

function main(): void {
  const args = process.argv.slice(2);
  console.log('db-refresh: reset then seed (same safety gates for both).');
  run('db-reset.ts', args);
  run('db-seed.ts', args);
  console.log('\ndb-refresh completed. Summary above.');
}

main();
