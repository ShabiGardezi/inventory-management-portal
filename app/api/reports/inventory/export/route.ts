import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';
import { getInventoryExport } from '@/server/services/reportService';

function toCSV(
  rows: Awaited<ReturnType<typeof getInventoryExport>>
): string {
  const header = [
    'Product',
    'SKU',
    'Category',
    'Warehouse',
    'On Hand',
    'Reorder Level',
    'Unit Cost',
    'Stock Value',
    'Status',
  ].join(',');
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((r) =>
    [
      r.name,
      r.sku,
      r.category ?? '',
      r.warehouseName,
      r.onHand,
      r.reorderLevel ?? '',
      r.unitCost ?? '',
      r.stockValue,
      r.isLowStock ? 'Low Stock' : 'OK',
    ].map(escape).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([
      'export.read',
      'reports.read',
      'reports:read',
      'inventory.read',
      'inventory:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      category: searchParams.get('category') ?? searchParams.get('categoryId') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      lowStockOnly: searchParams.get('lowStockOnly') === 'true',
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    };
    const rows = await getInventoryExport(user, query);
    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-report-${new Date().toISOString().slice(0, 10)}.csv"`,
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
    console.error('GET /api/reports/inventory/export error:', error);
    return createErrorResponse('Failed to export inventory report', 500);
  }
}
