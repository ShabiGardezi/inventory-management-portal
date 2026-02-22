import { NextRequest } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

export interface ProductMetricsItem {
  minDaysOfCover: number;
  suggestedReorderQty: number;
}

/** GET ?productIds=id1,id2 — returns { metrics: { [productId]: { minDaysOfCover, suggestedReorderQty } } } */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('product:read');
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('productIds') ?? '';
    const productIds = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (productIds.length === 0) {
      return createSuccessResponse({ metrics: {} });
    }
    if (productIds.length > 200) {
      return createErrorResponse('Too many product IDs (max 200)', 400);
    }

    const rows = await prisma.inventoryMetrics.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        daysOfCover: true,
        suggestedReorderQty: true,
      },
    });

    const metrics: Record<string, ProductMetricsItem> = {};
    for (const id of productIds) {
      metrics[id] = { minDaysOfCover: Infinity, suggestedReorderQty: 0 };
    }
    for (const r of rows) {
      const doc = Number(r.daysOfCover);
      const qty = Number(r.suggestedReorderQty);
      const cur = metrics[r.productId];
      if (cur) {
        if (Number.isFinite(doc) && doc < cur.minDaysOfCover) cur.minDaysOfCover = doc;
        cur.suggestedReorderQty += qty;
      }
    }
    for (const id of productIds) {
      const m = metrics[id];
      if (m.minDaysOfCover === Infinity) m.minDaysOfCover = 0;
    }

    return createSuccessResponse({ metrics });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    return createErrorResponse('Failed to load product metrics', 500);
  }
}
