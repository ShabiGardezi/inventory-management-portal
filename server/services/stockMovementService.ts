import { prisma } from '@/lib/prisma';
import * as repo from '@/server/repositories/stockMovementRepo';
import type { ListMovementsParams, MovementRow } from '@/server/repositories/stockMovementRepo';

export type DateRange = '7d' | '30d' | '90d' | 'custom';

function parseRangeToDates(
  range: DateRange,
  from?: string,
  to?: string
): { from: Date; to: Date } {
  const now = new Date();
  let start: Date;

  switch (range) {
    case '7d':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      break;
    case 'custom':
      start = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 30);
  }

  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(now);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < now.getTime()) end.setTime(now.getTime());
  return { from: start, to: end };
}

export interface GetMovementsQuery {
  range?: string;
  from?: string;
  to?: string;
  q?: string;
  warehouseId?: string;
  productId?: string;
  type?: repo.StockMovementTypeFilter;
  referenceType?: repo.ReferenceTypeFilter;
  performedBy?: string;
  mine?: string;
  page?: string;
  pageSize?: string;
  sort?: 'createdAt' | 'quantity';
  order?: 'asc' | 'desc';
}

export async function getMovementsList(
  query: GetMovementsQuery,
  userId?: string
): Promise<repo.ListMovementsResult> {
  const range = (query.range as DateRange) ?? '30d';
  const { from, to } = parseRangeToDates(range, query.from, query.to);

  const params: ListMovementsParams = {
    from,
    to,
    q: query.q,
    warehouseId: query.warehouseId ?? undefined,
    productId: query.productId ?? undefined,
    type: query.type as repo.StockMovementTypeFilter | undefined,
    referenceType: query.referenceType as repo.ReferenceTypeFilter | undefined,
    performedBy: query.performedBy ?? undefined,
    mine: query.mine === 'true',
    userId: userId ?? undefined,
    page: query.page ? parseInt(query.page, 10) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    sort: query.sort === 'quantity' ? 'quantity' : 'createdAt',
    order: query.order === 'asc' ? 'asc' : 'desc',
  };

  return repo.listMovements(params, prisma);
}

export async function getMovementById(id: string): Promise<MovementRow | null> {
  return repo.getMovementById(id, prisma);
}

export async function getMovementsForExport(
  query: Omit<GetMovementsQuery, 'page' | 'pageSize'>,
  userId?: string
): Promise<MovementRow[]> {
  const range = (query.range as DateRange) ?? '30d';
  const { from, to } = parseRangeToDates(range, query.from, query.to);

  const params: Omit<ListMovementsParams, 'page' | 'pageSize'> = {
    from,
    to,
    q: query.q,
    warehouseId: query.warehouseId ?? undefined,
    productId: query.productId ?? undefined,
    type: query.type as repo.StockMovementTypeFilter | undefined,
    referenceType: query.referenceType as repo.ReferenceTypeFilter | undefined,
    performedBy: query.performedBy ?? undefined,
    mine: query.mine === 'true',
    userId: userId ?? undefined,
    sort: query.sort === 'quantity' ? 'quantity' : 'createdAt',
    order: query.order === 'asc' ? 'asc' : 'desc',
  };

  return repo.listMovementsForExport(params, prisma);
}
