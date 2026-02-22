/**
 * Test DB strategy:
 * - Use DATABASE_URL_TEST if set, else DATABASE_URL (separate DB for tests recommended).
 * - globalSetup runs prisma migrate deploy (or db push) so test DB schema is applied.
 * - setupFiles (this file) runs before each test file; overrides process.env so lib/prisma and helpers use test DB.
 * - Tests reset DB between runs via resetTestDb (truncate in FK-safe order).
 */
import { config } from 'dotenv';
config();

const testDbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!testDbUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
}

export { testDbUrl };

if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  process.env.DIRECT_URL = process.env.DIRECT_URL_TEST ?? process.env.DATABASE_URL_TEST;
}
