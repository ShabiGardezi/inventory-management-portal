/**
 * Test DB: use DATABASE_URL_TEST if set, else DATABASE_URL.
 * Ensures app singleton (lib/prisma) and test helpers use the same DB when running Vitest.
 * Run migrations on the test DB once (e.g. DATABASE_URL_TEST=... npx prisma migrate deploy).
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
