import { PrismaClient, Prisma } from '@prisma/client';

export type StockMovementTypeFilter = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
export type ReferenceTypeFilter = 'PURCHASE' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'MANUAL';

export interface ListMovementsParams {
  from?: Date;
  to?: Date;
  q?: string;
  warehouseId?: string;
  productId?: string;
  type?: StockMovementTypeFilter;
  referenceType?: ReferenceTypeFilter;
  performedBy?: string;
  mine?: boolean;
  userId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'quantity';
  order?: 'asc' | 'desc';
}

export interface MovementRow {
  id: string;
  productId: string;
  warehouseId: string;
  movementType: string;
  quantity: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
  product: { id: string; name: string; sku: string };
  warehouse: { id: string; name: string; code: string | null };
  createdBy: { id: string; name: string | null; email: string } | null;
}

export interface ListMovementsResult {
  rows: MovementRow[];
  total: number;
  page: number;
  pageSize: number;
}

function buildWhere(
  params: ListMovementsParams,
  prisma: PrismaClient
): Prisma.StockMovementWhereInput {
  const where: Prisma.StockMovementWhereInput = {};

  if (params.from ?? params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = params.from;
    if (params.to) where.createdAt.lte = params.to;
  }

  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.productId) where.productId = params.productId;
  if (params.type) where.movementType = params.type;
  if (params.referenceType) where.referenceType = params.referenceType;
  if (params.performedBy) where.createdById = params.performedBy;
  if (params.mine && params.userId) where.createdById = params.userId;

  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { product: { name: { contains: q, mode: 'insensitive' } } },
      { product: { sku: { contains: q, mode: 'insensitive' } } },
      { referenceNumber: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listMovements(
  params: ListMovementsParams,
  prisma: PrismaClient
): Promise<ListMovementsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const orderBy: Prisma.StockMovementOrderByWithRelationInput =
    params.sort === 'quantity'
      ? { quantity: params.order ?? 'desc' }
      : { createdAt: params.order ?? 'desc' };

  const where = buildWhere(params, prisma);

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    rows: rows.map((m) => ({
      id: m.id,
      productId: m.productId,
      warehouseId: m.warehouseId,
      movementType: m.movementType,
      quantity: m.quantity.toString(),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      referenceNumber: m.referenceNumber,
      notes: m.notes,
      createdById: m.createdById,
      createdAt: m.createdAt,
      product: m.product,
      warehouse: m.warehouse,
      createdBy: m.createdBy,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getMovementById(
  id: string,
  prisma: PrismaClient
): Promise<MovementRow | null> {
  const m = await prisma.stockMovement.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!m) return null;
  return {
    id: m.id,
    productId: m.productId,
    warehouseId: m.warehouseId,
    movementType: m.movementType,
    quantity: m.quantity.toString(),
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    referenceNumber: m.referenceNumber,
    notes: m.notes,
    createdById: m.createdById,
    createdAt: m.createdAt,
    product: m.product,
    warehouse: m.warehouse,
    createdBy: m.createdBy,
  };
}

export async function listMovementsForExport(
  params: Omit<ListMovementsParams, 'page' | 'pageSize'>,
  prisma: PrismaClient,
  limit: number = 10000
): Promise<MovementRow[]> {
  const orderBy: Prisma.StockMovementOrderByWithRelationInput = {
    createdAt: params.order ?? 'desc',
  };
  const where = buildWhere(params, prisma);

  const rows = await prisma.stockMovement.findMany({
    where,
    take: limit,
    orderBy,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    productId: m.productId,
    warehouseId: m.warehouseId,
    movementType: m.movementType,
    quantity: m.quantity.toString(),
    referenceType: m.referenceType,
    referenceId: m.referenceId,
    referenceNumber: m.referenceNumber,
    notes: m.notes,
    createdById: m.createdById,
    createdAt: m.createdAt,
    product: m.product,
    warehouse: m.warehouse,
    createdBy: m.createdBy,
  }));
}
