import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { StockService } from './stock.service';
import { InventoryMetricsService } from './inventoryMetricsService';
import { createAuditLog } from './auditService';
import { getInventoryRules } from './settingsService';

/** Matches Prisma enum ApprovalEntityType */
export type ApprovalEntityType = 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER' | 'PURCHASE_RECEIVE' | 'SALE_CONFIRM';
/** Matches Prisma enum ApprovalStatus */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalPolicyContext {
  tenantId?: string | null;
  /** Optional: for PURCHASE_RECEIVE, total amount to check against policy.minAmount */
  minAmount?: number | Decimal | null;
  warehouseId?: string | null;
}

export interface RequestApprovalParams {
  entityType: ApprovalEntityType;
  entityId: string;
  requestedBy: string;
  requestComment?: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
}

export interface ApproveRequestParams {
  requestId: string;
  reviewerId: string;
  comment?: string | null;
}

export interface RejectRequestParams {
  requestId: string;
  reviewerId: string;
  comment?: string | null;
}

export interface CancelRequestParams {
  requestId: string;
  requesterId: string;
  /** When set, allows cancellation by a user with approvals.manage even if not the requester */
  cancelledByUserId?: string;
}

/**
 * Checks approval_policies for the given entity type and optional context.
 * Returns true if a policy exists, is enabled, and (if minAmount/warehouseScope) context matches.
 */
export async function isApprovalRequired(
  prisma: PrismaClient,
  entityType: ApprovalEntityType,
  context: ApprovalPolicyContext = {}
): Promise<boolean> {
  const tenantId = context.tenantId ?? null;
  const policy = await prisma.approvalPolicy.findFirst({
    where: {
      entityType,
      ...(tenantId !== undefined && tenantId !== null ? { tenantId } : { tenantId: null }),
    },
  });
  if (!policy || !policy.isEnabled) return false;
  if (policy.minAmount != null && context.minAmount != null) {
    const amount = typeof context.minAmount === 'number' ? new Decimal(context.minAmount) : context.minAmount;
    if (amount.lt(policy.minAmount)) return false;
  }
  if (policy.warehouseScopeId != null && context.warehouseId != null) {
    if (policy.warehouseScopeId !== context.warehouseId) return false;
  }
  return true;
}

/**
 * Creates an approval request (PENDING). Caller must have created the entity (e.g. PurchaseReceiveRequest, Sale, StockAdjustment, StockTransfer) and pass its id as entityId.
 * Throws if a PENDING request already exists for (entityType, entityId) due to unique index.
 */
export async function requestApproval(
  prisma: PrismaClient,
  params: RequestApprovalParams
): Promise<{ id: string; entityType: ApprovalEntityType; entityId: string; status: ApprovalStatus }> {
  const req = await prisma.approvalRequest.create({
    data: {
      tenantId: params.tenantId ?? null,
      entityType: params.entityType,
      entityId: params.entityId,
      status: 'PENDING',
      requestedByUserId: params.requestedBy,
      requestComment: params.requestComment ?? null,
      metadata: params.metadata == null ? undefined : (params.metadata as object),
    },
    select: { id: true, entityType: true, entityId: true, status: true },
  });
  await createAuditLog({
    userId: params.requestedBy,
    action: 'CREATE',
    resource: 'approval_request',
    resourceId: req.id,
    description: 'Approval requested',
    metadata: { entityType: params.entityType, entityId: params.entityId },
  });
  return req;
}

/**
 * Approves a request and executes the underlying action exactly once (idempotent).
 * Updates request to APPROVED, then runs execution for the entity; updates entity status and writes audit.
 */
export async function approveRequest(
  prisma: PrismaClient,
  params: ApproveRequestParams
): Promise<{ requestId: string; executed: boolean }> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      status: true,
      requestedByUserId: true,
      metadata: true,
    },
  });
  if (!request) throw new Error('Approval request not found');
  if (request.status !== 'PENDING') {
    if (request.status === 'APPROVED') {
      return { requestId: params.requestId, executed: false };
    }
    throw new Error(`Request cannot be approved: status is ${request.status}`);
  }

  const now = new Date();
  let executed = false;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.approvalRequest.updateMany({
      where: { id: params.requestId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedByUserId: params.reviewerId,
        reviewedAt: now,
        reviewComment: params.comment ?? null,
        updatedAt: now,
      },
    });
    if (updated.count === 0) return;

    const stockService = new StockService(tx as PrismaClient);
    const metricsService = new InventoryMetricsService(tx as PrismaClient);
    const allowNegativeDefault = (await getInventoryRules())?.allowNegativeStock ?? false;

    switch (request.entityType) {
      case 'PURCHASE_RECEIVE': {
        const rec = await tx.purchaseReceiveRequest.findUnique({
          where: { id: request.entityId },
          select: { id: true, status: true, payload: true, referenceNumber: true, notes: true },
        });
        if (!rec) throw new Error('Purchase receive request not found');
        if (rec.status === 'RECEIVED') {
          executed = false;
          return;
        }
        const payload = rec.payload as {
          items?: Array<{
            productId: string;
            warehouseId: string;
            quantity: number;
            batchId?: string;
            batchInput?: { batchNumber: string; expiryDate?: string; mfgDate?: string };
            serialNumbers?: string[];
          }>;
        } | null;
        const items = payload?.items ?? [];
        if (items.length === 0) throw new Error('Purchase receive request has no items');
        for (const item of items) {
          const batchInput = item.batchInput
            ? {
                batchNumber: item.batchInput.batchNumber,
                expiryDate: item.batchInput.expiryDate ? new Date(item.batchInput.expiryDate) : undefined,
                mfgDate: item.batchInput.mfgDate ? new Date(item.batchInput.mfgDate) : undefined,
              }
            : undefined;
          await stockService.receivePurchase({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
            referenceNumber: rec.referenceNumber ?? undefined,
            notes: rec.notes ?? undefined,
            referenceId: rec.id,
            createdById: params.reviewerId,
            batchId: item.batchId,
            batchInput,
            serialNumbers: item.serialNumbers,
          });
        }
        await tx.purchaseReceiveRequest.update({
          where: { id: rec.id },
          data: { status: 'RECEIVED', receivedAt: now, updatedAt: now },
        });
        executed = true;
        await createAuditLog({
          userId: params.reviewerId,
          action: 'UPDATE',
          resource: 'approval_execution',
          resourceId: request.id,
          description: 'Purchase receive executed after approval',
          metadata: { entityType: 'PURCHASE_RECEIVE', entityId: rec.id, before: rec.status, after: 'RECEIVED' },
        });
        const pairSet = new Map(
          items.map((i: { productId: string; warehouseId: string }) => [
            `${i.productId}:${i.warehouseId}`,
            { productId: i.productId, warehouseId: i.warehouseId },
          ])
        );
        const pairs = Array.from(pairSet.values());
        for (const p of pairs) {
          await metricsService.recomputeForProductWarehouse(p.productId, p.warehouseId);
        }
        break;
      }
      case 'SALE_CONFIRM': {
        const sale = await tx.sale.findUnique({
          where: { id: request.entityId },
          select: {
            id: true,
            status: true,
            referenceNumber: true,
            items: { select: { productId: true, warehouseId: true, quantity: true } },
          },
        });
        if (!sale) throw new Error('Sale not found');
        if (sale.status === 'CONFIRMED') {
          executed = false;
          return;
        }
        for (const item of sale.items) {
          await stockService.confirmSale({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: Number(item.quantity),
            referenceNumber: sale.referenceNumber ?? undefined,
            referenceId: sale.id,
            createdById: params.reviewerId,
            allowNegative: allowNegativeDefault,
          });
        }
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'CONFIRMED', updatedAt: now },
        });
        executed = true;
        await createAuditLog({
          userId: params.reviewerId,
          action: 'UPDATE',
          resource: 'approval_execution',
          resourceId: request.id,
          description: 'Sale confirm executed after approval',
          metadata: { entityType: 'SALE_CONFIRM', entityId: sale.id, before: sale.status, after: 'CONFIRMED' },
        });
        const pairSet = new Map<string, { productId: string; warehouseId: string }>();
        for (const i of sale.items) pairSet.set(`${i.productId}:${i.warehouseId}`, { productId: i.productId, warehouseId: i.warehouseId });
        for (const p of pairSet.values()) {
          await metricsService.recomputeForProductWarehouse(p.productId, p.warehouseId);
        }
        break;
      }
      case 'STOCK_ADJUSTMENT': {
        const adj = await tx.stockAdjustment.findUnique({
          where: { id: request.entityId },
          select: { id: true, status: true, productId: true, warehouseId: true, method: true, quantity: true, newQuantity: true, reason: true, notes: true },
        });
        if (!adj) throw new Error('Stock adjustment not found');
        if (adj.status === 'APPLIED') {
          executed = false;
          return;
        }
        const qty = adj.quantity != null ? Number(adj.quantity) : undefined;
        const newQty = adj.newQuantity != null ? Number(adj.newQuantity) : undefined;
        await stockService.adjustStock({
          productId: adj.productId,
          warehouseId: adj.warehouseId,
          method: adj.method as 'increase' | 'decrease' | 'set',
          quantity: qty,
          newQuantity: newQty,
          reason: adj.reason as 'damage' | 'recount' | 'correction' | 'opening_stock',
          notes: adj.notes ?? undefined,
          createdById: params.reviewerId,
          allowNegative: allowNegativeDefault,
        });
        await tx.stockAdjustment.update({
          where: { id: adj.id },
          data: { status: 'APPLIED', appliedAt: now, updatedAt: now },
        });
        executed = true;
        await createAuditLog({
          userId: params.reviewerId,
          action: 'UPDATE',
          resource: 'approval_execution',
          resourceId: request.id,
          description: 'Stock adjustment executed after approval',
          metadata: { entityType: 'STOCK_ADJUSTMENT', entityId: adj.id, before: adj.status, after: 'APPLIED' },
        });
        await metricsService.recomputeForProductWarehouse(adj.productId, adj.warehouseId);
        break;
      }
      case 'STOCK_TRANSFER': {
        const tr = await tx.stockTransfer.findUnique({
          where: { id: request.entityId },
          select: { id: true, status: true, productId: true, fromWarehouseId: true, toWarehouseId: true, quantity: true, notes: true },
        });
        if (!tr) throw new Error('Stock transfer not found');
        if (tr.status === 'APPLIED') {
          executed = false;
          return;
        }
        await stockService.transferStock({
          productId: tr.productId,
          fromWarehouseId: tr.fromWarehouseId,
          toWarehouseId: tr.toWarehouseId,
          quantity: Number(tr.quantity),
          notes: tr.notes ?? undefined,
          createdById: params.reviewerId,
          allowNegative: allowNegativeDefault,
        });
        await tx.stockTransfer.update({
          where: { id: tr.id },
          data: { status: 'APPLIED', appliedAt: now, updatedAt: now },
        });
        executed = true;
        await createAuditLog({
          userId: params.reviewerId,
          action: 'UPDATE',
          resource: 'approval_execution',
          resourceId: request.id,
          description: 'Stock transfer executed after approval',
          metadata: { entityType: 'STOCK_TRANSFER', entityId: tr.id, before: tr.status, after: 'APPLIED' },
        });
        await metricsService.recomputeForProductWarehouse(tr.productId, tr.fromWarehouseId);
        await metricsService.recomputeForProductWarehouse(tr.productId, tr.toWarehouseId);
        break;
      }
      default:
        throw new Error(`Unsupported entity type: ${request.entityType}`);
    }
  });

  await createAuditLog({
    userId: params.reviewerId,
    action: 'UPDATE',
    resource: 'approval_request',
    resourceId: params.requestId,
    description: 'Approval request approved',
    metadata: { requestId: params.requestId, entityType: request.entityType, entityId: request.entityId, executed },
  });

  return { requestId: params.requestId, executed };
}

/**
 * Rejects a request. Updates entity status to REJECTED where applicable.
 */
export async function rejectRequest(
  prisma: PrismaClient,
  params: RejectRequestParams
): Promise<void> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, entityType: true, entityId: true, status: true },
  });
  if (!request) throw new Error('Approval request not found');
  if (request.status !== 'PENDING') throw new Error(`Request cannot be rejected: status is ${request.status}`);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'REJECTED',
        reviewedByUserId: params.reviewerId,
        reviewedAt: now,
        reviewComment: params.comment ?? null,
        updatedAt: now,
      },
    });
    switch (request.entityType) {
      case 'PURCHASE_RECEIVE':
        await tx.purchaseReceiveRequest.updateMany({
          where: { id: request.entityId },
          data: { status: 'REJECTED', updatedAt: now },
        });
        break;
      case 'SALE_CONFIRM':
        await tx.sale.updateMany({
          where: { id: request.entityId },
          data: { status: 'REJECTED', updatedAt: now },
        });
        break;
      case 'STOCK_ADJUSTMENT':
        await tx.stockAdjustment.updateMany({
          where: { id: request.entityId },
          data: { status: 'REJECTED', updatedAt: now },
        });
        break;
      case 'STOCK_TRANSFER':
        await tx.stockTransfer.updateMany({
          where: { id: request.entityId },
          data: { status: 'REJECTED', updatedAt: now },
        });
        break;
    }
  });

  await createAuditLog({
    userId: params.reviewerId,
    action: 'UPDATE',
    resource: 'approval_request',
    resourceId: params.requestId,
    description: 'Approval request rejected',
    metadata: { requestId: params.requestId, entityType: request.entityType, entityId: request.entityId },
  });
}

/**
 * Cancels a PENDING request (only the requester). Sets request to CANCELLED; entity status left as-is or set to CANCELLED where applicable.
 */
export async function cancelRequest(
  prisma: PrismaClient,
  params: CancelRequestParams
): Promise<void> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: params.requestId },
    select: { id: true, entityType: true, entityId: true, status: true, requestedByUserId: true },
  });
  if (!request) throw new Error('Approval request not found');
  if (request.status !== 'PENDING') throw new Error(`Request cannot be cancelled: status is ${request.status}`);
  const allowed =
    request.requestedByUserId === params.requesterId || (params.cancelledByUserId != null && params.cancelledByUserId === params.requesterId);
  if (!allowed) {
    throw new Error('Only the requester or a user with approvals.manage can cancel the request');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.update({
      where: { id: params.requestId },
      data: { status: 'CANCELLED', updatedAt: now },
    });
    switch (request.entityType) {
      case 'PURCHASE_RECEIVE':
        await tx.purchaseReceiveRequest.updateMany({
          where: { id: request.entityId },
          data: { status: 'CANCELLED', updatedAt: now },
        });
        break;
      case 'SALE_CONFIRM':
        await tx.sale.updateMany({
          where: { id: request.entityId },
          data: { status: 'REJECTED', updatedAt: now },
        });
        break;
      case 'STOCK_ADJUSTMENT':
        await tx.stockAdjustment.updateMany({
          where: { id: request.entityId },
          data: { status: 'CANCELLED', updatedAt: now },
        });
        break;
      case 'STOCK_TRANSFER':
        await tx.stockTransfer.updateMany({
          where: { id: request.entityId },
          data: { status: 'CANCELLED', updatedAt: now },
        });
        break;
    }
  });

  await createAuditLog({
    userId: params.requesterId,
    action: 'UPDATE',
    resource: 'approval_request',
    resourceId: params.requestId,
    description: 'Approval request cancelled',
    metadata: { requestId: params.requestId, entityType: request.entityType, entityId: request.entityId },
  });
}
