/**
 * Phase 0: Warehouses with unique codes and realistic names.
 */

import type { PrismaClient } from '@prisma/client';

export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
}

const WAREHOUSE_DEFS: Array<{ name: string; city: string; address: string; country: string }> = [
  { name: 'Main', city: 'New York', address: '123 Main Street', country: 'USA' },
  { name: 'Branch 1', city: 'Los Angeles', address: '456 Oak Avenue', country: 'USA' },
  { name: 'Branch 2', city: 'Chicago', address: '321 Industrial Blvd', country: 'USA' },
  { name: 'Branch 3', city: 'Boston', address: '789 Harbor Drive', country: 'USA' },
  { name: 'Branch 4', city: 'Houston', address: '100 Commerce Way', country: 'USA' },
  { name: 'Branch 5', city: 'Phoenix', address: '200 Desert Rd', country: 'USA' },
  { name: 'Branch 6', city: 'Seattle', address: '300 Port Ave', country: 'USA' },
  { name: 'Branch 7', city: 'Denver', address: '400 Mountain View', country: 'USA' },
  { name: 'Branch 8', city: 'Atlanta', address: '500 Peach St', country: 'USA' },
  { name: 'Branch 9', city: 'Miami', address: '600 Ocean Dr', country: 'USA' },
];

export async function createWarehouses(
  prisma: PrismaClient,
  count: number
): Promise<WarehouseRecord[]> {
  const toCreate = Math.min(count, WAREHOUSE_DEFS.length);
  const results: WarehouseRecord[] = [];

  for (let i = 0; i < toCreate; i++) {
    const def = WAREHOUSE_DEFS[i]!;
    const code = `WH-${String(i + 1).padStart(3, '0')}`;
    const wh = await prisma.warehouse.upsert({
      where: { code },
      update: { name: def.name, address: def.address, city: def.city, country: def.country },
      create: {
        code,
        name: def.name,
        address: def.address,
        city: def.city,
        country: def.country,
        isActive: true,
      },
    });
    results.push({ id: wh.id, code: wh.code ?? '', name: wh.name });
  }

  return results;
}
