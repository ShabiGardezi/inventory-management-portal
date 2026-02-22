import type { PrismaClient } from '@prisma/client';

const WAREHOUSE_DEFS = [
  { name: 'Main', city: 'New York', address: '123 Main Street', country: 'USA' },
  { name: 'Branch 1', city: 'Los Angeles', address: '456 Oak Avenue', country: 'USA' },
  { name: 'Branch 2', city: 'Chicago', address: '321 Industrial Blvd', country: 'USA' },
  { name: 'Branch 3', city: 'Boston', address: '789 Harbor Drive', country: 'USA' },
  { name: 'Branch 4', city: 'Houston', address: '100 Commerce Way', country: 'USA' },
];

export interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
}

export async function seedWarehouses(
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
