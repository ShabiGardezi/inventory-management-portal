import { NextRequest } from 'next/server';
import type { ApprovalEntityType, ApprovalStatus } from '@/server/services/approvalService';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 100;

export async function GET(request: NextRequest) {
  try {
    await requirePermission('approvals.read');

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ApprovalStatus | undefined;
    const type = searchParams.get('type') as ApprovalEntityType | undefined;
    const dateFrom = searchParams.get('dateFrom') ?? undefined;
    const dateTo = searchParams.get('dateTo') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE_DEFAULT), 10))
    );

    const where: {
      status?: ApprovalStatus;
      entityType?: ApprovalEntityType;
      requestedAt?: { gte?: Date; lte?: Date };
    } = {};
    if (status) where.status = status;
    if (type) where.entityType = type;
    if (dateFrom || dateTo) {
      where.requestedAt = {};
      if (dateFrom) where.requestedAt.gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        where.requestedAt.lte = d;
      }
    }

    const [list, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          status: true,
          requestedAt: true,
          reviewedAt: true,
          requestComment: true,
          reviewComment: true,
          metadata: true,
          requestedBy: {
            select: { id: true, email: true, name: true },
          },
          reviewedBy: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    return createSuccessResponse({
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch approvals';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
