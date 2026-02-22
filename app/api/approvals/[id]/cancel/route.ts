import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireAuth,
  hasPermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { cancelRequest } from '@/server/services';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const { id } = await params;
    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { id: true, status: true, requestedByUserId: true },
    });
    if (!approval) return createErrorResponse('Approval request not found', 404);
    if (approval.status !== 'PENDING') {
      return createErrorResponse('Only pending requests can be cancelled', 400);
    }

    const isRequester = approval.requestedByUserId === user.id;
    const canManage = hasPermission(user, 'approvals.manage');
    if (!isRequester && !canManage) {
      return createErrorResponse('Forbidden: only requester or user with approvals.manage can cancel', 403);
    }

    await cancelRequest(prisma, {
      requestId: id,
      requesterId: user.id,
      ...(canManage ? { cancelledByUserId: user.id } : {}),
    });

    return createSuccessResponse({ requestId: id, message: 'Request cancelled' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to cancel';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    if (message.includes('not found')) return createErrorResponse(message, 404);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
