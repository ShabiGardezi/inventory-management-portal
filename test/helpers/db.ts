import { PrismaClient } from '@prisma/client';
import { testDbUrl } from '../setup';

/** Prisma client for tests (uses DATABASE_URL_TEST or DATABASE_URL). */
export function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: testDbUrl,
  });
}

/** FK-safe order for truncate/deleteMany (children first). */
const TRUNCATE_ORDER = [
  'auditLog',
  'productSerial',
  'stockMovement',
  'stockBalance',
  'inventoryMetrics',
  'reorderPolicy',
  'approvalRequest',
  'stockAdjustment',
  'stockTransfer',
  'purchaseReceiveRequest',
  'approvalPolicy',
  'batch',
  'userRole',
  'rolePermission',
  'userSettings',
  'user',
  'role',
  'permission',
  'product',
  'warehouse',
  'settings',
] as const;

export async function resetTestDb(prisma: PrismaClient): Promise<void> {
  for (const model of TRUNCATE_ORDER) {
    await (prisma as unknown as Record<string, { deleteMany: (args?: object) => Promise<unknown> }>)[model]?.deleteMany?.({});
  }
}
