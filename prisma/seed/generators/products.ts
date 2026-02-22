import type { PrismaClient } from '@prisma/client';
import { randomInt, money, skuGenerator } from '../utils';

const CATEGORIES = [
  'Electronics', 'Furniture', 'Office Supplies', 'Appliances', 'Tools',
  'Safety', 'Cleaning', 'Stationery', 'Packaging', 'Uncategorized',
];

const PRODUCT_NAME_PARTS: Record<string, string[]> = {
  Electronics: ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'USB Hub', 'Webcam', 'Headset', 'Cable', 'Adapter', 'Charger'],
  Furniture: ['Desk', 'Chair', 'Cabinet', 'Shelf', 'Lamp', 'Stand', 'Table', 'Stool', 'Rack', 'Organizer'],
  'Office Supplies': ['Paper', 'Stapler', 'Pen', 'Notebook', 'Folder', 'Clip', 'Tape', 'Marker', 'Envelope', 'Binder'],
  Appliances: ['Fan', 'Heater', 'Kettle', 'Monitor Arm', 'Desk Fan', 'LED Light', 'Power Strip', 'Surge Protector'],
  Tools: ['Screwdriver', 'Wrench', 'Pliers', 'Drill', 'Hammer', 'Tape Measure', 'Level', 'Knife', 'Scissors'],
  Safety: ['Gloves', 'Goggles', 'Mask', 'Vest', 'Helmet', 'First Aid', 'Sign', 'Cone', 'Tape'],
  Cleaning: ['Spray', 'Wipe', 'Mop', 'Broom', 'Bucket', 'Brush', 'Soap', 'Towel', 'Bag'],
  Stationery: ['Notebook', 'Pen Set', 'Eraser', 'Highlighter', 'Sticky Notes', 'Calculator', 'Ruler', 'Staples'],
  Packaging: ['Box', 'Bubble Wrap', 'Tape', 'Label', 'Envelope', 'Pouch', 'Mailer', 'Carton'],
  Uncategorized: ['Item', 'Product', 'Unit', 'Kit', 'Set', 'Pack', 'Bundle', 'Assorted'],
};

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  costPrice: number;
  reorderLevel: number;
}

export async function seedProducts(
  prisma: PrismaClient,
  count: number
): Promise<ProductRecord[]> {
  const results: ProductRecord[] = [];
  const batchSize = 100;

  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    const data: Array<{
      sku: string;
      name: string;
      description: string | null;
      category: string;
      unit: string;
      price: number;
      costPrice: number;
      reorderLevel: number;
      isActive: boolean;
    }> = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const category = CATEGORIES[randomInt(0, CATEGORIES.length - 1)]!;
      const parts = PRODUCT_NAME_PARTS[category];
      const baseName = parts ? parts[randomInt(0, parts.length - 1)]! : 'Product';
      const variant = randomInt(1, 999);
      const name = `${baseName} ${variant}`;
      const sku = skuGenerator('SKU', i + 1, 6);

      const costPrice = money(randomInt(5, 200) + randomInt(0, 99) / 100);
      const margin = randomInt(15, 55) / 100;
      const price = money(costPrice * (1 + margin));
      const reorderLevel = randomInt(5, 30);

      data.push({
        sku,
        name,
        description: `${name} - ${category}`,
        category,
        unit: 'pcs',
        price,
        costPrice,
        reorderLevel,
        isActive: true,
      });
    }

    const created = await prisma.product.createManyAndReturn({
      data: data.map((d) => ({
        sku: d.sku,
        name: d.name,
        description: d.description,
        category: d.category,
        unit: d.unit,
        price: d.price,
        costPrice: d.costPrice,
        reorderLevel: d.reorderLevel,
        isActive: d.isActive,
      })),
      skipDuplicates: true,
    });

    for (const p of created) {
      const d = data.find((x) => x.sku === p.sku);
      results.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: d ? d.price : Number(p.price),
        costPrice: d ? d.costPrice : Number(p.costPrice),
        reorderLevel: d ? d.reorderLevel : (p.reorderLevel ?? 10),
      });
    }
  }

  return results;
}
