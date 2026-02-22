/**
 * Production-safe full seed (Phase 0–5). Uses SEED_SCALE (small|medium|large) and SEED_KEY for determinism.
 * All stock changes go through StockService. Runs safety gates (allowMissingSettings for post-reset).
 *
 * Required env: ALLOW_DB_RESET, CONFIRM_RESET_TEXT, BACKUP_CONFIRMED; production also ALLOW_PROD_RESET.
 * Optional: VALUATION_METHOD=FIFO|AVERAGE_COST, ENABLE_APPROVALS=true, DISABLE_LOCKDOWN_AFTER_SEED=true.
 *
 * Usage: npx tsx scripts/db-seed.ts [--yes]   (--yes skips human verification)
 */

import 'dotenv/config';

// Use direct DB URL for long-running seed to avoid pooler (pgbouncer) closing the connection
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from '@prisma/client';
import {
  runSafetyGates,
  runHumanVerification,
  parseDatabaseUrl,
} from './safety-gates';
import { runIntegrityChecks } from '@/lib/verify-integrity';
import {
  getSeedScale,
  getSeedCounts,
  getSeedFromKey,
  getValuationMethod,
  getEnableApprovals,
  getDisableLockdownAfterSeed,
} from './seed/config';
import { createRolesAndUsers } from './seed/rolesAndUsers';
import { createWarehouses } from './seed/warehouses';
import { createProducts } from './seed/products';
import { createSettings, updateSettingsLockdown } from './seed/settings';
import { createPurchasesAndReceive } from './seed/purchasesAndReceive';
import { createSalesAndConfirm } from './seed/salesAndConfirm';
import { createTransfers } from './seed/transfers';
import { createAdjustments } from './seed/adjustments';
import { createApprovalPoliciesAndRequests } from './seed/approvalPolicies';
import { createReorderPoliciesAndMetrics } from './seed/reorderAndMetrics';
import { seedAuditLogs } from './seed/audit';

const prisma = new PrismaClient();
const SKIP_VERIFICATION = process.argv.includes('--yes');
const DEFAULT_PASSWORD = 'password123';

async function runVerification(): Promise<void> {
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
}

async function printSummary(): Promise<void> {
  const users = await prisma.user.count();
  const roles = await prisma.role.count();
  const permissions = await prisma.permission.count();
  const warehouses = await prisma.warehouse.count();
  const products = await prisma.product.count();
  const batches = await prisma.batch.count();
  const serials = await prisma.productSerial.count();
  const serialsInStock = await prisma.productSerial.count({ where: { status: 'IN_STOCK' } });
  const serialsSold = await prisma.productSerial.count({ where: { status: 'SOLD' } });
  const purchasesRefs = (await prisma.stockMovement.groupBy({
    by: ['referenceNumber'],
    where: { referenceType: 'PURCHASE', referenceNumber: { not: null } },
  })).length;
  const salesRefs = (await prisma.stockMovement.groupBy({
    by: ['referenceNumber'],
    where: { referenceType: 'SALE', referenceNumber: { not: null } },
  })).length;
  const movements = await prisma.stockMovement.count();
  const balances = await prisma.stockBalance.count();
  const layers = await prisma.inventoryLayer.count();
  const consumptions = await prisma.inventoryConsumption.count();
  const approvalReqs = await prisma.approvalRequest.count();
  const approvalPending = await prisma.approvalRequest.count({ where: { status: 'PENDING' } });
  const approvalApproved = await prisma.approvalRequest.count({ where: { status: 'APPROVED' } });
  const approvalRejected = await prisma.approvalRequest.count({ where: { status: 'REJECTED' } });
  const reorderPolicies = await prisma.reorderPolicy.count();
  const metrics = await prisma.inventoryMetrics.count();
  const auditLogs = await prisma.auditLog.count();

  console.log('\n--- Summary counts ---');
  console.log('  users:', users, '| roles:', roles, '| permissions:', permissions);
  console.log('  warehouses:', warehouses, '| products:', products);
  console.log('  batches:', batches, '| serials:', serials, '(IN_STOCK:', serialsInStock, '| SOLD:', serialsSold, ')');
  console.log('  purchases (refs):', purchasesRefs, '| sales (refs):', salesRefs);
  console.log('  stock_movements:', movements, '| stock_balances:', balances);
  console.log('  inventory_layers:', layers, '| inventory_consumptions:', consumptions);
  console.log('  approval_requests:', approvalReqs, '(pending:', approvalPending, '| approved:', approvalApproved, '| rejected:', approvalRejected, ')');
  console.log('  reorder_policies:', reorderPolicies, '| inventory_metrics:', metrics);
  console.log('  audit_logs:', auditLogs);
}

async function printSampleScanCodes(): Promise<void> {
  const productsWithBarcode = await prisma.product.findMany({
    where: { barcode: { not: null } },
    take: 5,
    select: { barcode: true, sku: true },
  });
  const batchesWithBarcode = await prisma.batch.findMany({
    where: { barcode: { not: null } },
    take: 2,
    select: { barcode: true, batchNumber: true },
  });
  const serialsSample = await prisma.productSerial.findMany({
    take: 3,
    select: { serialNumber: true },
  });

  console.log('\n--- Sample scan codes (Phase 5) ---');
  console.log('  Product barcodes:', productsWithBarcode.map((p) => p.barcode).join(', ') || '(none)');
  console.log('  SKUs:', productsWithBarcode.slice(0, 3).map((p) => p.sku).join(', ') || '(none)');
  console.log('  Serial numbers:', serialsSample.map((s) => s.serialNumber).join(', ') || '(none)');
  console.log('  Batch numbers/barcodes:', batchesWithBarcode.map((b) => b.batchNumber + (b.barcode ? ` / ${b.barcode}` : '')).join(', ') || '(none)');
}

async function main(): Promise<void> {
  console.log('db-seed: checking safety gates...\n');

  const gates = await runSafetyGates(prisma, { allowMissingSettings: true });
  if (!gates.ok) {
    console.error('Safety gate failed:', gates.error);
    process.exit(1);
  }

  await runVerification();

  const scale = getSeedScale();
  const counts = getSeedCounts(scale);
  const seed = getSeedFromKey();
  const valuationMethod = getValuationMethod();
  const enableApprovals = getEnableApprovals();

  console.log('Seed scale:', scale, '| SEED_KEY seed:', seed, '| valuation:', valuationMethod, '| approvals:', enableApprovals);

  console.log('\n1. Settings (systemLockdown=true)...');
  await createSettings(prisma, {
    valuationMethod,
    systemLockdown: true,
    allowNegativeStock: false,
    enableBarcode: true,
  });

  console.log('2. Roles and users...');
  const usersResult = await createRolesAndUsers(prisma, DEFAULT_PASSWORD);

  console.log('3. Warehouses...');
  const warehouses = await createWarehouses(prisma, counts.warehouses);

  console.log('4. Products (normal + batch + serial + barcode)...');
  let products = await createProducts(prisma, counts.products, seed);
  if (products.length === 0) {
    const existing = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        price: true,
        costPrice: true,
        reorderLevel: true,
        trackBatches: true,
        trackSerials: true,
        barcode: true,
      },
    });
    products = existing.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: Number(p.price ?? 0),
      costPrice: Number(p.costPrice ?? 0),
      reorderLevel: p.reorderLevel ?? 10,
      trackBatches: p.trackBatches,
      trackSerials: p.trackSerials,
      barcode: p.barcode,
    }));
  }

  console.log('5. Purchases + receive (StockService)...');
  const balanceMap = await createPurchasesAndReceive(prisma, {
    products,
    warehouses,
    users: usersResult,
    count: counts.purchases,
    itemsMin: counts.purchaseItemsMin,
    itemsMax: counts.purchaseItemsMax,
    daysBack: counts.daysBack,
    seed,
  });

  console.log('6. Sales + confirm (StockService)...');
  await createSalesAndConfirm(prisma, {
    products,
    warehouses,
    users: usersResult,
    balanceMap,
    count: counts.sales,
    itemsMin: counts.saleItemsMin,
    itemsMax: counts.saleItemsMax,
    seed,
  });

  console.log('7. Transfers (StockService)...');
  await createTransfers(prisma, {
    products,
    warehouses,
    users: usersResult,
    balanceMap,
    count: counts.transfers,
    seed,
  });

  console.log('8. Adjustments (StockService)...');
  await createAdjustments(prisma, {
    products,
    warehouses,
    users: usersResult,
    balanceMap,
    count: counts.adjustments,
    seed,
  });

  console.log('9. Approval policies + sample requests...');
  const approvalResult = await createApprovalPoliciesAndRequests(prisma, {
    enableApprovals,
    users: usersResult,
    createSampleRequests: enableApprovals,
  });
  console.log('   Policies:', approvalResult.policiesCreated, '| Pending:', approvalResult.pending, '| Approved:', approvalResult.approved, '| Rejected:', approvalResult.rejected);

  console.log('10. Reorder policies + metrics...');
  const reorderResult = await createReorderPoliciesAndMetrics(prisma, {
    products,
    warehouses,
    countPolicyPerProduct: 1,
    seed,
  });
  console.log('   Policies:', reorderResult.policiesCreated, '| Metrics computed:', reorderResult.metricsComputed);

  console.log('11. Audit logs...');
  const auditCount = await seedAuditLogs(prisma, {
    users: usersResult,
    daysBack: counts.daysBack,
    count: 200,
    seed,
  });
  console.log('   Created:', auditCount);

  if (getDisableLockdownAfterSeed()) {
    console.log('12. Disabling systemLockdown (DISABLE_LOCKDOWN_AFTER_SEED=true)...');
    await updateSettingsLockdown(prisma, false);
  }

  console.log('\nVerifying integrity...');
  const { ok, errors } = await runIntegrityChecks(prisma);
  if (!ok) {
    console.error('Integrity check FAILED:');
    errors.forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log('Integrity check passed.');

  await printSummary();
  await printSampleScanCodes();

  console.log('\nSeed completed. Logins (password: ' + DEFAULT_PASSWORD + '):');
  console.log('  admin@local, manager@local, staff1@local, staff2@local, viewer@local');
}

main()
  .catch((err) => {
    console.error('db-seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
