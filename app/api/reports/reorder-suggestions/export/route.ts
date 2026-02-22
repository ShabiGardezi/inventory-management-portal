import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';
import { getReorderSuggestionsExport } from '@/server/services/reportService';

export const dynamic = 'force-dynamic';

function toCSV(
  rows: Awaited<ReturnType<typeof getReorderSuggestionsExport>>
): string {
  const header = [
    'Product',
    'SKU',
    'Warehouse',
    'Current Stock',
    'Avg Daily Sales',
    'Days of Cover',
    'Suggested Reorder Qty',
    'Predicted Stockout Date',
  ].join(',');
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((r) =>
    [
      r.productName,
      r.sku,
      r.warehouseName,
      r.currentStock,
      r.avgDailySales,
      r.daysOfCover,
      r.suggestedReorderQty,
      r.predictedStockoutDate ? r.predictedStockoutDate.toISOString().slice(0, 10) : '',
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
      productId: searchParams.get('productId') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      lowDaysOnly: searchParams.get('lowDaysOnly') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    };
    const rows = await getReorderSuggestionsExport(user, query);
    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reorder-suggestions-${new Date().toISOString().slice(0, 10)}.csv"`,
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
    console.error('GET /api/reports/reorder-suggestions/export error:', error);
    return createErrorResponse('Failed to export reorder suggestions', 500);
  }
}
