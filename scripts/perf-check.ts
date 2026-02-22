/**
 * Runs a few key queries and logs timings (dev/test only).
 * Usage: npx tsx scripts/perf-check.ts
 * Requires DATABASE_URL in .env.
 */

import { prisma } from '@/lib/prisma';

async function timeLabel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`  ${label}: ${ms}ms`);
  return result;
}

async function main(): Promise<void> {
  console.log('Perf check (key queries)...\n');

  await timeLabel('stock_balances count', () =>
    prisma.stockBalance.count()
  );

  await timeLabel('stock_balances findMany (first 100)', () =>
    prisma.stockBalance.findMany({
      take: 100,
      select: { productId: true, warehouseId: true, quantity: true, available: true },
    })
  );

  await timeLabel('stock_movements count', () =>
    prisma.stockMovement.count()
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  await timeLabel('stock_movements last 7d (paginated 50)', () =>
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        movementType: true,
        quantity: true,
        createdAt: true,
        productId: true,
        warehouseId: true,
      },
    })
  );

  await timeLabel('products count (active)', () =>
    prisma.product.count({ where: { isActive: true } })
  );

  await timeLabel('dashboard-style: total stock value (balances + product price)', async () => {
    const balances = await prisma.stockBalance.findMany({
      include: { product: { select: { price: true } } },
    });
    let total = 0;
    for (const b of balances) {
      const qty = Number(b.quantity);
      const price = b.product.price != null ? Number(b.product.price) : 0;
      total += qty * price;
    }
    return total;
  });

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
