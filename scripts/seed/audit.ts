/**
 * Audit log entries for major actions (seed adds variety; StockService/ApprovalService already log).
 */

import type { PrismaClient } from '@prisma/client';
import { initSeed, pickOne, randomDateBetween } from '@/prisma/seed/utils';
import type { SeedRolesAndUsersResult } from './rolesAndUsers';

const RESOURCES = ['product', 'warehouse', 'stock_movement', 'purchase', 'sale', 'approval_request', 'settings'];
const ACTIONS = ['CREATE', 'UPDATE', 'VIEW', 'LOGIN'] as const;

export async function seedAuditLogs(
  prisma: PrismaClient,
  options: {
    users: SeedRolesAndUsersResult;
    daysBack: number;
    count: number;
    seed: number;
  }
): Promise<number> {
  initSeed(options.seed + 5);
  const userIds = Array.from(options.users.userIdByEmail.values());
  if (userIds.length === 0) return 0;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - options.daysBack);

  const data: Array<{
    userId: string;
    action: (typeof ACTIONS)[number];
    resource: string;
    resourceId: string | null;
    description: string;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < options.count; i++) {
    const action = pickOne([...ACTIONS]);
    const resource = pickOne(RESOURCES);
    const userId = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);
    data.push({
      userId,
      action,
      resource,
      resourceId: `res-${i}`,
      description: `${action} ${resource}`,
      createdAt,
    });
  }

  await prisma.auditLog.createMany({
    data: data.map((c) => ({
      userId: c.userId,
      action: c.action,
      resource: c.resource,
      resourceId: c.resourceId,
      description: c.description,
      createdAt: c.createdAt,
    })),
  });

  return data.length;
}
