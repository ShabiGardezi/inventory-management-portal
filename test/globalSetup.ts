/**
 * Runs once before all integration tests.
 * Uses DATABASE_URL_TEST (or DATABASE_URL), applies schema via prisma migrate deploy.
 * If no migrations exist or deploy fails, runs db push. Use a local test DB to avoid long timeouts.
 */
import { config } from 'dotenv';
import { execSync } from 'node:child_process';

const SETUP_TIMEOUT_MS = 60_000;

config();

const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
}

process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = process.env.DIRECT_URL_TEST ?? testUrl;

const execOpts = { stdio: 'inherit' as const, env: process.env, timeout: SETUP_TIMEOUT_MS };

try {
  execSync('npx prisma migrate deploy', execOpts);
} catch {
  try {
    execSync('npx prisma db push', execOpts);
  } catch (e) {
    console.error('globalSetup: migrate deploy and db push failed. Ensure test DB is reachable.');
    throw e;
  }
}
