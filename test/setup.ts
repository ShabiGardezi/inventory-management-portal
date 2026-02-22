/**
 * Test DB URL: DATABASE_URL_TEST or DATABASE_URL.
 * Load .env so DATABASE_URL is available when running vitest.
 * Run migrations before integration tests (e.g. npm run db:migrate with DATABASE_URL_TEST).
 */
import { config } from 'dotenv';
config();
export const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
if (!testDbUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_TEST must be set for integration tests');
}
