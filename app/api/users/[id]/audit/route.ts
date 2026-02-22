import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuditLogsByUserId } from '@/server/services/auditService';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('audit.read');
    const { id: userId } = await params;
    const { searchParams } = new URL(_request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '10', 10)));
    const skip = (page - 1) * pageSize;
    const { rows, total } = await getAuditLogsByUserId(userId, skip, pageSize);
    return createSuccessResponse({ rows, total, page, pageSize });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized: Authentication required') {
      return createErrorResponse(message, 401);
    }
    if (message.startsWith('Forbidden:')) {
      return createErrorResponse(message, 403);
    }
    console.error('GET /api/users/[id]/audit error:', err);
    return createErrorResponse('Failed to fetch audit logs', 500);
  }
}
