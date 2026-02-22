import { PrismaClient, Prisma } from '@prisma/client';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface WarehouseListFilters {
  search?: string;
  status?: 'active' | 'inactive';
  lowStockOnly?: boolean;
}

export interface WarehouseListResult {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalSkus: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  lastMovementDate: Date | null;
}

export interface WarehouseStockRow {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  onHand: number;
  reorderLevel: number | null;
  value: number;
  lastUpdated: Date;
}

export interface MovementRow {
  id: string;
  date: Date;
  type: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  referenceNumber: string | null;
  performedById: string | null;
  performedByName: string | null;
}

export interface TransferRow {
  id: string;
  referenceNumber: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  createdAt: Date;
  createdById: string | null;
  createdByName: string | null;
}

export class WarehouseRepository {
  constructor(private prisma: PrismaClient | PrismaTransactionClient) {}

  async findMany(
    filters: WarehouseListFilters,
    skip: number,
    take: number,
    orderBy: Prisma.WarehouseOrderByWithRelationInput
  ): Promise<{ id: string; name: string; code: string | null; address: string | null; city: string | null; country: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }[]> {
    const where = await this.buildListWhere(filters);
    return this.prisma.warehouse.findMany({
      where,
      skip,
      take,
      orderBy,
    });
  }

  async count(filters: WarehouseListFilters): Promise<number> {
    const where = await this.buildListWhere(filters);
    return this.prisma.warehouse.count({ where });
  }

  private async buildListWhere(filters: WarehouseListFilters): Promise<Prisma.WarehouseWhereInput> {
    const where: Prisma.WarehouseWhereInput = {};
    if (filters.status === 'active') where.isActive = true;
    if (filters.status === 'inactive') where.isActive = false;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.lowStockOnly) {
      const lowStockWarehouseIds = await this.getWarehouseIdsWithLowStock();
      where.id = { in: lowStockWarehouseIds };
    }
    return where;
  }

  private async getWarehouseIdsWithLowStock(): Promise<string[]> {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        quantity: { gt: 0 },
        product: {
          reorderLevel: { not: null, gt: 0 },
        },
      },
      select: { warehouseId: true, quantity: true, product: { select: { reorderLevel: true } } },
    });
    const ids = new Set<string>();
    for (const b of balances) {
      const reorder = b.product.reorderLevel ?? 0;
      if (Number(b.quantity) < reorder) ids.add(b.warehouseId);
    }
    return Array.from(ids);
  }

  async findById(id: string) {
    return this.prisma.warehouse.findUnique({
      where: { id },
    });
  }

  async create(data: {
    name: string;
    code?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  }) {
    return this.prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      code?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
      isActive?: boolean;
    }
  ) {
    return this.prisma.warehouse.update({
      where: { id },
      data,
    });
  }

  async getWarehouseListWithStats(
    filters: WarehouseListFilters,
    skip: number,
    take: number,
    orderByKey: string,
    orderByDir: 'asc' | 'desc'
  ): Promise<{ list: WarehouseListResult[]; total: number }> {
    const orderBy: Prisma.WarehouseOrderByWithRelationInput =
      orderByKey === 'name' ? { name: orderByDir } : orderByKey === 'createdAt' ? { createdAt: orderByDir } : { name: 'asc' };
    const [warehouses, total] = await Promise.all([
      this.findMany(filters, skip, take, orderBy),
      this.count(filters),
    ]);

    const list: WarehouseListResult[] = [];
    for (const wh of warehouses) {
      const stats = await this.getWarehouseStats(wh.id);
      const lastMovement = await this.prisma.stockMovement.findFirst({
        where: { warehouseId: wh.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      list.push({
        ...wh,
        totalSkus: stats.totalSkus,
        totalQuantity: stats.totalQuantity,
        totalValue: stats.totalValue,
        lowStockCount: stats.lowStockCount,
        lastMovementDate: lastMovement?.createdAt ?? null,
      });
    }

    return { list, total };
  }

  async getWarehouseStats(warehouseId: string): Promise<{
    totalSkus: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;
  }> {
    const balances = await this.prisma.stockBalance.findMany({
      where: { warehouseId, quantity: { gt: 0 } },
      include: {
        product: {
          select: {
            id: true,
            costPrice: true,
            price: true,
            reorderLevel: true,
          },
        },
      },
    });

    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    for (const b of balances) {
      const qty = Number(b.quantity);
      totalQuantity += qty;
      const cost = b.product.costPrice != null ? Number(b.product.costPrice) : Number(b.product.price ?? 0);
      totalValue += qty * cost;
      const reorder = b.product.reorderLevel ?? 0;
      if (reorder > 0 && qty < reorder) lowStockCount += 1;
    }

    return {
      totalSkus: balances.length,
      totalQuantity,
      totalValue,
      lowStockCount,
    };
  }

  async getWarehouseByIdWithStats(warehouseId: string) {
    const warehouse = await this.findById(warehouseId);
    if (!warehouse) return null;
    const stats = await this.getWarehouseStats(warehouseId);
    const lastMovement = await this.prisma.stockMovement.findFirst({
      where: { warehouseId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const movementsThisWeek = await this.prisma.stockMovement.count({
      where: {
        warehouseId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    return {
      ...warehouse,
      ...stats,
      lastMovementDate: lastMovement?.createdAt ?? null,
      movementsThisWeek,
    };
  }

  async getStockTable(
    warehouseId: string,
    options: { skip: number; take: number; search?: string; lowStockOnly?: boolean; sortBy?: string; sortDir?: 'asc' | 'desc' }
  ): Promise<{ rows: WarehouseStockRow[]; total: number }> {
    const whereProduct: Prisma.ProductWhereInput = { isActive: true };
    if (options.search) {
      whereProduct.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: { warehouseId, product: whereProduct },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            costPrice: true,
            price: true,
            reorderLevel: true,
          },
        },
      },
    });

    let rows: WarehouseStockRow[] = balances
      .filter((b) => b.product != null)
      .map((b) => {
        const p = b.product!;
        const onHand = Number(b.quantity);
        const reorderLevel = p.reorderLevel;
        const cost = p.costPrice != null ? Number(p.costPrice) : Number(p.price ?? 0);
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          category: p.category,
          onHand,
          reorderLevel,
          value: onHand * cost,
          lastUpdated: b.lastUpdated,
        };
      });

    if (options.lowStockOnly) {
      rows = rows.filter((r) => r.reorderLevel != null && r.reorderLevel > 0 && r.onHand < r.reorderLevel);
    }

    const total = rows.length;

    const sortBy = options.sortBy ?? 'productName';
    const sortDir = options.sortDir ?? 'asc';
    const toSortVal = (v: unknown): string | number | Date =>
      typeof v === 'string' || typeof v === 'number' || v instanceof Date ? v : '';
    rows.sort((a, b) => {
      let aVal: string | number | Date = toSortVal((a as unknown as Record<string, unknown>)[sortBy]);
      let bVal: string | number | Date = toSortVal((b as unknown as Record<string, unknown>)[sortBy]);
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = (bVal as string).toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    rows = rows.slice(options.skip, options.skip + options.take);
    return { rows, total };
  }

  async getMovements(
    warehouseId: string,
    options: {
      skip: number;
      take: number;
      type?: string;
      productId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<{ rows: MovementRow[]; total: number }> {
    const where: Prisma.StockMovementWhereInput = { warehouseId };
    if (options.type) where.movementType = options.type as 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
    if (options.productId) where.productId = options.productId;
    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    const rows: MovementRow[] = movements.map((m) => ({
      id: m.id,
      date: m.createdAt,
      type: m.movementType,
      productId: m.productId,
      productName: m.product.name,
      sku: m.product.sku,
      quantity: Number(m.quantity),
      referenceNumber: m.referenceNumber,
      performedById: m.createdById,
      performedByName: m.createdBy?.name ?? null,
    }));

    return { rows, total };
  }

  async getTransfersInvolvingWarehouse(
    warehouseId: string,
    skip: number,
    take: number
  ): Promise<{ rows: TransferRow[]; total: number }> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        warehouseId,
        movementType: { in: ['IN', 'OUT'] },
        referenceNumber: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const currentWh = await this.findById(warehouseId);
    const currentName = currentWh?.name ?? '';

    const transfers: TransferRow[] = [];
    for (const m of movements) {
      const ref = m.referenceNumber!;
      if (!ref.startsWith('TR-')) continue;
      const notes = m.notes ?? '';
      const fromMatch = notes.match(/Transfer from ([^\s:]+)/i);
      const toMatch = notes.match(/Transfer to ([^\s:]+)/i);
      const otherWarehouseId =
        m.movementType === 'IN'
          ? (fromMatch && fromMatch[1] ? fromMatch[1] : '')
          : (toMatch && toMatch[1] ? toMatch[1] : '');
      const otherWh = otherWarehouseId
        ? await this.prisma.warehouse.findUnique({ where: { id: otherWarehouseId }, select: { name: true } })
        : null;
      const otherName = otherWh?.name ?? otherWarehouseId;
      const fromId = m.movementType === 'OUT' ? warehouseId : otherWarehouseId;
      const toId = m.movementType === 'IN' ? warehouseId : otherWarehouseId;
      const fromName = m.movementType === 'OUT' ? currentName : otherName;
      const toName = m.movementType === 'IN' ? currentName : otherName;
      transfers.push({
        id: m.id,
        referenceNumber: ref,
        productId: m.productId,
        productName: m.product.name,
        sku: m.product.sku,
        quantity: Number(m.quantity),
        fromWarehouseId: fromId,
        fromWarehouseName: fromName,
        toWarehouseId: toId,
        toWarehouseName: toName,
        createdAt: m.createdAt,
        createdById: m.createdById,
        createdByName: m.createdBy?.name ?? null,
      });
    }

    const total = transfers.length;
    const rows = transfers.slice(skip, skip + take);
    return { rows, total };
  }

  async getMovementTrend(warehouseId: string, days: number): Promise<{ date: string; in: number; out: number }[]> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        warehouseId,
        createdAt: { gte: start },
      },
      select: { movementType: true, quantity: true, createdAt: true },
    });

    const byDate = new Map<string, { in: number; out: number }>();
    for (let d = 0; d < days; d++) {
      const dte = new Date(start);
      dte.setDate(dte.getDate() + d);
      const key = dte.toISOString().slice(0, 10);
      byDate.set(key, { in: 0, out: 0 });
    }
    for (const m of movements) {
      const key = m.createdAt.toISOString().slice(0, 10);
      const entry = byDate.get(key) ?? { in: 0, out: 0 };
      const q = Number(m.quantity);
      if (m.movementType === 'IN') entry.in += q;
      else entry.out += Math.abs(q);
      byDate.set(key, entry);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, in: v.in, out: v.out }));
  }

  async getTopMovedProducts(warehouseId: string, days: number, limit: number) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const agg = await this.prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { warehouseId, createdAt: { gte: start } },
      _sum: { quantity: true },
      _count: true,
    });

    const productIds = agg.map((a) => a.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const withNames = agg
      .map((a) => ({
        productId: a.productId,
        productName: productMap.get(a.productId)?.name ?? '',
        sku: productMap.get(a.productId)?.sku ?? '',
        totalQty: Math.abs(Number(a._sum.quantity ?? 0)),
      }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, limit);

    return withNames;
  }

  async getAuditLogs(
    resource: string,
    resourceId: string,
    skip: number,
    take: number
  ): Promise<{ rows: { id: string; action: string; description: string | null; createdAt: Date; userName: string | null }[]; total: number }> {
    const where = { resource, resourceId };
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const rows = logs.map((l) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      createdAt: l.createdAt,
      userName: l.user?.name ?? null,
    }));
    return { rows, total };
  }

  async getAggregateStats(): Promise<{
    totalWarehouses: number;
    totalStockValue: number;
    totalLowStockItems: number;
    transfersThisWeek: number;
  }> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    let totalStockValue = 0;
    let totalLowStockItems = 0;
    for (const wh of warehouses) {
      const s = await this.getWarehouseStats(wh.id);
      totalStockValue += s.totalValue;
      totalLowStockItems += s.lowStockCount;
    }
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const transfersThisWeek = await this.prisma.stockMovement.count({
      where: {
        movementType: 'IN',
        referenceNumber: { not: null },
        createdAt: { gte: weekStart },
      },
    });
    return {
      totalWarehouses: warehouses.length,
      totalStockValue,
      totalLowStockItems,
      transfersThisWeek,
    };
  }
}
