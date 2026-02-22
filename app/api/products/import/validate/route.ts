import { NextRequest } from 'next/server';
import { requireAnyPermission, createErrorResponse, createSuccessResponse } from '@/lib/rbac';
import {
  validateImportFile,
  parseCSV,
  parseXLSX,
  type RawImportRow,
} from '@/server/services/productImportService';

const IMPORT_PERMISSIONS = ['product:import', 'product:create'];

export async function POST(request: NextRequest) {
  try {
    await requireAnyPermission(IMPORT_PERMISSIONS);

    const contentType = request.headers.get('content-type') ?? '';
    let rows: RawImportRow[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return createErrorResponse('No file provided', 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.xlsx')) {
        rows = parseXLSX(buffer);
      } else if (name.endsWith('.csv')) {
        rows = parseCSV(buffer);
      } else {
        return createErrorResponse('File must be .csv or .xlsx', 400);
      }
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const raw = body.rows ?? body;
      if (!Array.isArray(raw)) {
        return createErrorResponse('JSON body must contain "rows" array', 400);
      }
      rows = raw as RawImportRow[];
    } else {
      return createErrorResponse('Content-Type must be multipart/form-data or application/json', 400);
    }

    const result = validateImportFile(rows);
    return createSuccessResponse(result, 200);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized', 401);
      }
      if (err.message.includes('Forbidden')) {
        return createErrorResponse(err.message, 403);
      }
    }
    return createErrorResponse('Validation failed', 500);
  }
}
