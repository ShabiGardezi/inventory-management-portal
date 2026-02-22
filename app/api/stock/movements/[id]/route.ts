import { NextRequest } from 'next/server';
import {
  requireAnyPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { getMovementById } from '@/server/services/stockMovementService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAnyPermission(['stock:read', 'inventory:read']);
    const { id } = await params;
    const movement = await getMovementById(id);
    if (!movement) {
      return createErrorResponse('Movement not found', 404);
    }
    return createSuccessResponse(movement);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('GET /api/stock/movements/[id] error:', error);
    return createErrorResponse('Failed to load movement', 500);
  }
}
