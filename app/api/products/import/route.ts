import { NextRequest } from 'next/server';
import { requireAnyPermission, createErrorResponse, createSuccessResponse } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  parseCSV,
  parseXLSX,
  runImport,
} from '@/server/services/productImportService';
import type { RawImportRow } from '@/server/validators/productImportSchemas';
import { z } from 'zod';

const IMPORT_PERMISSIONS = ['product:import', 'product:create'];

const importBodySchema = z.object({
  mode: z.enum(['create_only', 'upsert']).default('create_only'),
  allowPartial: z.boolean().default(false),
  defaultWarehouseId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyPermission(IMPORT_PERMISSIONS);

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return createErrorResponse('Content-Type must be multipart/form-data', 400);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const optionsStr = formData.get('options') as string | null;

    if (!file) {
      return createErrorResponse('No file provided', 400);
    }

    const options = importBodySchema.safeParse(
      optionsStr ? JSON.parse(optionsStr) : {}
    );
    const opts = options.success ? options.data : { mode: 'create_only' as const, allowPartial: false, defaultWarehouseId: null };

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = (file.name || '').toLowerCase();
    let rows: RawImportRow[] = [];
    if (name.endsWith('.xlsx')) {
      rows = parseXLSX(buffer);
    } else if (name.endsWith('.csv')) {
      rows = parseCSV(buffer);
    } else {
      return createErrorResponse('File must be .csv or .xlsx', 400);
    }

    if (rows.length === 0) {
      return createErrorResponse('File contains no data rows', 400);
    }

    const result = await runImport(prisma, rows, opts, user.id);
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
    return createErrorResponse('Import failed', 500);
  }
}
