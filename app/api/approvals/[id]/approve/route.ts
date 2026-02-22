import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { approveRequest } from '@/server/services';

const bodySchema = z.object({
  comment: z.string().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('approvals.review');

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    const comment = parsed.success ? parsed.data.comment ?? undefined : undefined;

    const result = await approveRequest(prisma, {
      requestId: id,
      reviewerId: user.id,
      comment,
    });

    return createSuccessResponse({
      requestId: result.requestId,
      executed: result.executed,
      message: result.executed ? 'Request approved and execution completed' : 'Request already approved (no re-execution)',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    if (message.includes('not found')) return createErrorResponse(message, 404);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
