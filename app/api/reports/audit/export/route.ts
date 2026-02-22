import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
} from '@/lib/rbac';
import { getAuditExport } from '@/server/services/reportService';

export const dynamic = 'force-dynamic';

function toCSV(rows: Awaited<ReturnType<typeof getAuditExport>>): string {
  const header = [
    'Date',
    'Actor',
    'Action',
    'Entity Type',
    'Entity ID',
    'Metadata Summary',
  ].join(',');
  const escape = (v: string | null | undefined) => {
    if (v == null) return '""';
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };
  const lines = rows.map((r) =>
    [
      r.date,
      r.actorEmail ?? r.actorName ?? '',
      r.action,
      r.resource,
      r.resourceId ?? '',
      (r.metadataSummary ?? '').replace(/\r?\n/g, ' '),
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
      'audit.read',
      'audit:read',
    ]);
    const { searchParams } = new URL(request.url);
    const query = {
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      actorId: searchParams.get('actorId') ?? undefined,
      action: searchParams.get('action') ?? undefined,
      resource: searchParams.get('resource') ?? undefined,
    };
    const rows = await getAuditExport(user, query);
    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-report-${new Date().toISOString().slice(0, 10)}.csv"`,
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
    console.error('GET /api/reports/audit/export error:', error);
    return createErrorResponse('Failed to export audit report', 500);
  }
}
