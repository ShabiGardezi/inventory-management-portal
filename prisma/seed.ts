/**
 * Prisma seed: bulk demo data for Inventory Management System.
 * Modes:
 *   - Default (npm run db:seed): seed-if-empty
 *   - --reset: reset-and-seed (wipes business tables then seeds)
 *
 * Set SEED=123 for reproducible data.
 */
import { PrismaClient } from '@prisma/client';
import { getSeedConfig, type SeedConfig } from './seed/seedConfig';
import { initSeed } from './seed/utils';
import { seedPermissions, seedRoles } from './seed/generators/rolesPermissions';
import { seedUsers } from './seed/generators/users';
import { seedWarehouses } from './seed/generators/warehouses';
import { seedProducts } from './seed/generators/products';
import { generateSupplierNames } from './seed/generators/suppliers';
import { generateCustomerNames } from './seed/generators/customers';
import {
  seedPurchases,
  seedSales,
  seedTransfers,
  seedAdjustments,
  syncBalancesFromLedger,
  type StockSeedContext,
} from './seed/generators/stock';
import { seedAuditLogs } from './seed/generators/audit';
import { seedSettings } from './seed/generators/settings';

const prisma = new PrismaClient();

const RESET_FLAG = process.argv.includes('--reset');

async function isAnyDataPresent(): Promise<boolean> {
  const [products, warehouses, movements] = await Promise.all([
    prisma.product.count(),
    prisma.warehouse.count(),
    prisma.stockMovement.count(),
  ]);
  return products > 0 || warehouses > 0 || movements > 0;
}

async function wipeBusinessTables(): Promise<void> {
  console.log('🗑️  Wiping business tables (FK-safe order)...');
  await prisma.auditLog.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.stockBalance.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.userSettings.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.warehouse.deleteMany({});
  await prisma.settings.deleteMany({});
  console.log('✅ Wipe complete.');
}

function validateBalances(prisma: PrismaClient): Promise<{ ok: boolean; negative: number; mismatch: number }> {
  return prisma.$transaction(async (tx) => {
    const balances = await tx.stockBalance.findMany({
      select: { productId: true, warehouseId: true, quantity: true },
    });
    let negative = 0;
    for (const b of balances) {
      const q = Number(b.quantity);
      if (q < 0) negative++;
    }

    const movements = await tx.stockMovement.findMany({
      select: { productId: true, warehouseId: true, movementType: true, quantity: true },
    });
    const byKey = new Map<string, number>();
    for (const m of movements) {
      const k = `${m.productId}:${m.warehouseId}`;
      const q = Number(m.quantity);
      const cur = byKey.get(k) ?? 0;
      byKey.set(k, m.movementType === 'IN' ? cur + q : cur - q);
    }

    let mismatch = 0;
    for (const b of balances) {
      const k = `${b.productId}:${b.warehouseId}`;
      const expected = Math.max(0, byKey.get(k) ?? 0);
      const actual = Number(b.quantity);
      if (Math.abs(expected - actual) > 0.01) mismatch++;
    }
    return { ok: negative === 0 && mismatch === 0, negative, mismatch };
  });
}

async function printSummary(prisma: PrismaClient): Promise<void> {
  const [
    users,
    roles,
    permissions,
    warehouses,
    products,
    movements,
    balances,
    auditLogs,
    purchaseRefs,
    saleRefs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.warehouse.count(),
    prisma.product.count(),
    prisma.stockMovement.count(),
    prisma.stockBalance.count(),
    prisma.auditLog.count(),
    prisma.stockMovement.groupBy({
      by: ['referenceNumber'],
      where: { referenceType: 'PURCHASE', referenceNumber: { not: null } },
    }).then((g) => g.length),
    prisma.stockMovement.groupBy({
      by: ['referenceNumber'],
      where: { referenceType: 'SALE', referenceNumber: { not: null } },
    }).then((g) => g.length),
  ]);
  console.log('\n📊 Seed summary');
  console.log('  Users:', users);
  console.log('  Roles:', roles);
  console.log('  Permissions:', permissions);
  console.log('  Warehouses:', warehouses);
  console.log('  Products:', products);
  console.log('  Stock movements:', movements);
  console.log('  Stock balances:', balances);
  console.log('  Purchase orders (refs):', purchaseRefs);
  console.log('  Sales orders (refs):', saleRefs);
  console.log('  Audit logs:', auditLogs);
  console.log('\n✨ Seed completed successfully.');
  console.log('  Test login: admin@example.com / password123');
}

async function runSeed(config: SeedConfig): Promise<void> {
  initSeed(config.seed);

  const permissions = await seedPermissions(prisma);
  console.log('✅ Permissions:', permissions.length);

  const roles = await seedRoles(prisma, permissions);
  console.log('✅ Roles:', roles.length);

  const { users, userIdByEmail } = await seedUsers(
    prisma,
    config.users,
    roles,
    'password123'
  );
  console.log('✅ Users:', users.length);

  const warehouses = await seedWarehouses(prisma, config.warehouses);
  console.log('✅ Warehouses:', warehouses.length);

  const products = await seedProducts(prisma, config.products);
  console.log('✅ Products:', products.length);

  const supplierNames = generateSupplierNames(config.suppliers);
  const customerNames = generateCustomerNames(config.customers);

  const balanceMap = new Map<string, number>();
  const stockCtx: StockSeedContext = {
    products,
    warehouses,
    users: { users, userIdByEmail },
    supplierNames,
    customerNames,
    config: {
      purchases: config.purchases,
      purchaseItemsMin: config.purchaseItemsMin,
      purchaseItemsMax: config.purchaseItemsMax,
      sales: config.sales,
      saleItemsMin: config.saleItemsMin,
      saleItemsMax: config.saleItemsMax,
      transfers: config.transfers,
      adjustments: config.adjustments,
      daysBack: config.daysBack,
    },
  };

  console.log('  Creating purchase movements (IN)...');
  await seedPurchases(prisma, stockCtx, balanceMap);
  console.log('  Creating sales movements (OUT)...');
  await seedSales(prisma, stockCtx, balanceMap);
  console.log('  Creating transfers...');
  await seedTransfers(prisma, stockCtx, balanceMap);
  console.log('  Creating adjustments...');
  await seedAdjustments(prisma, stockCtx, balanceMap);
  console.log('  Syncing balances from ledger...');
  await syncBalancesFromLedger(prisma);
  console.log('✅ Stock movements and balances done.');

  const auditCount = await seedAuditLogs(prisma, {
    users: { users, userIdByEmail },
    daysBack: config.daysBack,
    count: 400,
  });
  console.log('✅ Audit logs:', auditCount);

  await seedSettings(prisma);
  console.log('✅ Settings defaults.');

  const validation = await validateBalances(prisma);
  if (!validation.ok) {
    console.warn('⚠️  Validation: negative balances:', validation.negative, 'mismatch:', validation.mismatch);
  } else {
    console.log('✅ Validation: no negative balances, ledger matches.');
  }

  await printSummary(prisma);
}

async function main(): Promise<void> {
  console.log('🌱 Seed started. Mode:', RESET_FLAG ? 'reset-and-seed' : 'seed-if-empty');

  const config = getSeedConfig();
  if (RESET_FLAG) {
    await wipeBusinessTables();
  } else {
    const hasData = await isAnyDataPresent();
    if (hasData) {
      console.log('⏭️  Tables already have data. Skipping seed. Use --reset to wipe and reseed.');
      return;
    }
  }

  await runSeed(config);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
