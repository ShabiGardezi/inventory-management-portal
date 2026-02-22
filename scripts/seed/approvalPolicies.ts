/**
 * Phase 4: Approval policies and sample requests (pending, approved, rejected).
 */

import type { PrismaClient } from '@prisma/client';
import {
  requestApproval,
  approveRequest,
  rejectRequest,
  isApprovalRequired,
} from '@/server/services/approvalService';
import { StockService } from '@/server/services/stock.service';
import type { SeedRolesAndUsersResult } from './rolesAndUsers';

const ENTITY_TYPES = [
  'STOCK_ADJUSTMENT',
  'STOCK_TRANSFER',
  'PURCHASE_RECEIVE',
  'SALE_CONFIRM',
] as const;

export async function createApprovalPoliciesAndRequests(
  prisma: PrismaClient,
  options: {
    enableApprovals: boolean;
    users: SeedRolesAndUsersResult;
    createSampleRequests: boolean;
  }
): Promise<{ policiesCreated: number; pending: number; approved: number; rejected: number }> {
  let pending = 0;
  let approved = 0;
  let rejected = 0;

  for (const entityType of ENTITY_TYPES) {
    const existing = await prisma.approvalPolicy.findFirst({
      where: { tenantId: null, entityType },
    });
    if (existing) {
      await prisma.approvalPolicy.update({
        where: { id: existing.id },
        data: { isEnabled: options.enableApprovals },
      });
    } else {
      await prisma.approvalPolicy.create({
        data: {
          tenantId: null,
          entityType,
          isEnabled: options.enableApprovals,
          requiredPermission: 'approvals.review',
        },
      });
    }
  }

  if (!options.createSampleRequests || !options.enableApprovals) {
    return { policiesCreated: ENTITY_TYPES.length, pending, approved, rejected };
  }

  const adminId = options.users.adminUserId;
  const managerId = options.users.managerUserId;
  if (!adminId || !managerId) return { policiesCreated: ENTITY_TYPES.length, pending, approved, rejected };

  const stockService = new StockService(prisma);
  const [product] = await prisma.product.findMany({ take: 1, select: { id: true } });
  const [fromWh, toWh] = await prisma.warehouse.findMany({ take: 2, select: { id: true } });
  if (!product || !fromWh || !toWh || fromWh.id === toWh.id) {
    return { policiesCreated: ENTITY_TYPES.length, pending, approved, rejected };
  }

  const needsApproval = await isApprovalRequired(prisma, 'STOCK_ADJUSTMENT');
  if (needsApproval) {
    const adj = await prisma.stockAdjustment.create({
      data: {
        productId: product.id,
        warehouseId: fromWh.id,
        method: 'increase',
        quantity: 5,
        reason: 'correction',
        notes: 'Seed pending',
        status: 'PENDING_APPROVAL',
        requestedById: adminId,
      },
    });
    await requestApproval(prisma, {
      entityType: 'STOCK_ADJUSTMENT',
      entityId: adj.id,
      requestedBy: adminId,
      metadata: { productId: product.id, quantity: 5 },
    });
    pending++;
  }

  const adj2 = await prisma.stockAdjustment.create({
    data: {
      productId: product.id,
      warehouseId: fromWh.id,
      method: 'increase',
      quantity: 3,
      reason: 'opening_stock',
      notes: 'Seed to approve',
      status: 'PENDING_APPROVAL',
      requestedById: adminId,
    },
  });
  await requestApproval(prisma, {
    entityType: 'STOCK_ADJUSTMENT',
    entityId: adj2.id,
    requestedBy: adminId,
    metadata: { productId: product.id, quantity: 3 },
  });
  const reqApproved = await prisma.approvalRequest.findFirst({
    where: { entityType: 'STOCK_ADJUSTMENT', entityId: adj2.id, status: 'PENDING' },
  });
  if (reqApproved) {
    await approveRequest(prisma, { requestId: reqApproved.id, reviewerId: managerId });
    approved++;
  }

  const adj3 = await prisma.stockAdjustment.create({
    data: {
      productId: product.id,
      warehouseId: fromWh.id,
      method: 'decrease',
      quantity: 1,
      reason: 'damage',
      notes: 'Seed to reject',
      status: 'PENDING_APPROVAL',
      requestedById: adminId,
    },
  });
  await requestApproval(prisma, {
    entityType: 'STOCK_ADJUSTMENT',
    entityId: adj3.id,
    requestedBy: adminId,
    metadata: { productId: product.id, quantity: 1 },
  });
  const reqRejected = await prisma.approvalRequest.findFirst({
    where: { entityType: 'STOCK_ADJUSTMENT', entityId: adj3.id, status: 'PENDING' },
  });
  if (reqRejected) {
    await rejectRequest(prisma, { requestId: reqRejected.id, reviewerId: managerId, comment: 'Seed reject' });
    rejected++;
  }

  return { policiesCreated: ENTITY_TYPES.length, pending, approved, rejected };
}
