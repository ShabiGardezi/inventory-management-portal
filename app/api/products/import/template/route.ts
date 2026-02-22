import { NextRequest } from 'next/server';
import { requireAnyPermission, createErrorResponse } from '@/lib/rbac';
import { generateCSVTemplate, generateXLSXTemplate } from '@/server/services/productImportService';

const IMPORT_PERMISSIONS = ['product:import', 'product:create'];

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(IMPORT_PERMISSIONS);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') ?? 'csv';

    if (format === 'csv') {
      const body = generateCSVTemplate();
      return new Response(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="products_import_template.csv"',
        },
      });
    }

    if (format === 'xlsx') {
      const buffer = generateXLSXTemplate();
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="products_import_template.xlsx"',
        },
      });
    }

    return createErrorResponse('Invalid format. Use csv or xlsx', 400);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized', 401);
      }
      if (err.message.includes('Forbidden')) {
        return createErrorResponse(err.message, 403);
      }
    }
    return createErrorResponse('Failed to generate template', 500);
  }
}
