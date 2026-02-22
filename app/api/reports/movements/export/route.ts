import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';
import { getMovementsReportExport } from '@/server/services/reportService';

export const dynamic = 'force-dynamic';

function toCSV(
  rows: Awaited<ReturnType<typeof getMovementsReportExport>>
): string {
  const header = [
    'Date',
    'Type',
    'Product (SKU)',
    'Warehouse',
    'Quantity',
    'Reference Type',
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
      m.createdAt,
      m.movementType,
      `${m.product.name} (${m.product.sku})`,
      m.warehouse.name,
      m.movementType === 'OUT' ? `-${m.quantity}` : m.quantity,
      m.referenceType ?? '',
      m.referenceNumber ?? '',
      m.createdBy?.email ?? '',
      (m.notes ?? '').replace(/\r?\n/g, ' '),
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
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      referenceType: searchParams.get('referenceType') ?? undefined,
      performedBy: searchParams.get('performedBy') ?? undefined,
    };
    const rows = await getMovementsReportExport(user, query);
    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="movements-report-${new Date().toISOString().slice(0, 10)}.csv"`,
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
    console.error('GET /api/reports/movements/export error:', error);
    return createErrorResponse('Failed to export movements report', 500);
  }
}
