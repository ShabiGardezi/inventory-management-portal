import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';

export const dynamic = 'force-dynamic';
import { getMovementsForExport, type GetMovementsQuery } from '@/server/services/stockMovementService';

function toCSV(rows: Awaited<ReturnType<typeof getMovementsForExport>>): string {
  const header = [
    'Date',
    'Type',
    'Product (SKU)',
    'Warehouse',
    'Quantity',
    'Reference Type',
    'Reference ID',
    'Reference Number',
    'Performed By',
    'Notes',
  ].join(',');
  const escape = (v: string | null | undefined) => {
    if (v == null) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((m) =>
    [
      new Date(m.createdAt).toISOString(),
      m.movementType,
      `${m.product.name} (${m.product.sku})`,
      m.warehouse.name,
      m.movementType === 'OUT' ? `-${m.quantity}` : m.quantity,
      m.referenceType ?? '',
      m.referenceId ?? '',
      m.referenceNumber ?? '',
      m.createdBy?.email ?? '',
      (m.notes ?? '').replace(/\r?\n/g, ' '),
    ].map(escape).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission(['reports:read', 'inventory:read']);
    const { searchParams } = new URL(request.url);

    const sortParam = searchParams.get('sort');
    const orderParam = searchParams.get('order');
    const typeParam = searchParams.get('type');
    const movementType: GetMovementsQuery['type'] =
      typeParam === 'IN' || typeParam === 'OUT' || typeParam === 'TRANSFER' || typeParam === 'ADJUSTMENT'
        ? typeParam
        : undefined;
    const refTypeParam = searchParams.get('referenceType');
    const referenceType: GetMovementsQuery['referenceType'] =
      refTypeParam === 'PURCHASE' || refTypeParam === 'SALE' || refTypeParam === 'TRANSFER' || refTypeParam === 'ADJUSTMENT' || refTypeParam === 'MANUAL'
        ? refTypeParam
        : undefined;
    const query = {
      range: searchParams.get('range') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      productId: searchParams.get('productId') ?? undefined,
      type: movementType,
      referenceType,
      performedBy: searchParams.get('performedBy') ?? undefined,
      mine: searchParams.get('mine') ?? undefined,
      sort: sortParam === 'quantity' ? 'quantity' as const : sortParam === 'createdAt' ? 'createdAt' as const : undefined,
      order: orderParam === 'asc' ? 'asc' as const : orderParam === 'desc' ? 'desc' as const : undefined,
    } satisfies Omit<GetMovementsQuery, 'page' | 'pageSize'>;

    const rows = await getMovementsForExport(query, user.id);
    const csv = toCSV(rows);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stock-movements-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/stock/movements/export error:', error);
    return createErrorResponse('Failed to export stock movements', 500);
  }
}
