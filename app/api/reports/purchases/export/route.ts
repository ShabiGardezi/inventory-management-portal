import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';
import { getPurchasesExport } from '@/server/services/reportService';

function toCSV(rows: Awaited<ReturnType<typeof getPurchasesExport>>): string {
  const header = [
    'Date',
    'PO No',
    'Supplier',
    'Total',
    'Status',
    'Created By',
  ].join(',');
  const escape = (v: string | number | null | undefined) => {
    if (v == null) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((r) =>
    [
      r.date,
      r.referenceNumber ?? '',
      r.supplier ?? '',
      r.total,
      r.status,
      r.createdByEmail ?? r.createdByName ?? '',
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
      'purchase.read',
      'purchase:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      warehouseId: searchParams.get('warehouseId') ?? undefined,
    };
    const rows = await getPurchasesExport(user, query);
    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="purchases-report-${new Date().toISOString().slice(0, 10)}.csv"`,
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
    console.error('GET /api/reports/purchases/export error:', error);
    return createErrorResponse('Failed to export purchases report', 500);
  }
}
