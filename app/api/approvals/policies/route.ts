import { NextRequest } from 'next/server';
import type { ApprovalEntityType } from '@/server/services/approvalService';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';

const ENTITY_TYPES: ApprovalEntityType[] = [
  'PURCHASE_RECEIVE',
  'SALE_CONFIRM',
  'STOCK_ADJUSTMENT',
  'STOCK_TRANSFER',
];

export async function GET() {
  try {
    await requirePermission('approvals.manage');

    const policies = await prisma.approvalPolicy.findMany({
      where: { tenantId: null },
      select: {
        id: true,
        entityType: true,
        isEnabled: true,
        requiredPermission: true,
        minAmount: true,
        warehouseScopeId: true,
      },
    });

    const byType = new Map(policies.map((p) => [p.entityType, p]));
    const list = ENTITY_TYPES.map((entityType) => {
      const existing = byType.get(entityType);
      return {
        entityType,
        id: existing?.id ?? null,
        isEnabled: existing?.isEnabled ?? false,
        requiredPermission: existing?.requiredPermission ?? 'approvals.review',
        minAmount: existing?.minAmount != null ? Number(existing.minAmount) : null,
        warehouseScopeId: existing?.warehouseScopeId ?? null,
      };
    });

    return createSuccessResponse({ list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch policies';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePermission('approvals.manage');

    const body = await request.json().catch(() => ({}));
    const list = Array.isArray(body.list) ? body.list : body.policies;
    if (!Array.isArray(list) || list.length === 0) {
      return createErrorResponse('Body must include list (array of { entityType, isEnabled, requiredPermission?, minAmount? })', 400);
    }

    for (const item of list) {
      const entityType = item.entityType as ApprovalEntityType | undefined;
      if (!entityType || !ENTITY_TYPES.includes(entityType)) continue;
      const isEnabled = Boolean(item.isEnabled);
      const requiredPermission = typeof item.requiredPermission === 'string' ? item.requiredPermission : 'approvals.review';
      const minAmount = item.minAmount != null && item.minAmount !== '' ? Number(item.minAmount) : null;

      const existing = await prisma.approvalPolicy.findFirst({
        where: { tenantId: null, entityType },
      });
      if (existing) {
        await prisma.approvalPolicy.update({
          where: { id: existing.id },
          data: {
            isEnabled,
            requiredPermission: requiredPermission || null,
            minAmount: minAmount != null && Number.isFinite(minAmount) ? new Decimal(minAmount) : null,
          },
        });
      } else {
        await prisma.approvalPolicy.create({
          data: {
            tenantId: null,
            entityType,
            isEnabled,
            requiredPermission: requiredPermission || null,
            minAmount: minAmount != null && Number.isFinite(minAmount) ? new Decimal(minAmount) : null,
          },
        });
      }
    }

    return createSuccessResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update policies';
    if (message.startsWith('Unauthorized:')) return createErrorResponse(message, 401);
    if (message.startsWith('Forbidden:')) return createErrorResponse(message, 403);
    console.error(err);
    return createErrorResponse('Internal server error', 500);
  }
}
