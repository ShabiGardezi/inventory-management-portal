import type { PrismaClient } from '@prisma/client';
import { pickOne, randomDateBetween } from '../utils';
import type { SeedUsersResult } from './users';

const RESOURCES = ['product', 'warehouse', 'stock_movement', 'user', 'role', 'settings'];
const ACTIONS = ['CREATE', 'UPDATE', 'VIEW', 'LOGIN', 'LOGOUT'] as const;

/** Description templates for critical actions (transfer, adjustment, role assign) */
function pickDescription(
  action: (typeof ACTIONS)[number],
  resource: string,
  i: number
): string {
  if (action === 'LOGIN') return 'User login';
  if (action === 'LOGOUT') return 'User logout';
  if (action === 'CREATE' && resource === 'stock_movement') {
    const kind = pickOne(['Transfer TR', 'Adjustment ADJ', 'Purchase PO', 'Sale SO']);
    const ref = kind.includes('TR') ? 30000 + (i % 500) : kind.includes('ADJ') ? 40000 + (i % 200) : kind.includes('PO') ? 10000 + (i % 300) : 20000 + (i % 700);
    return `${kind}-${ref}`;
  }
  if (action === 'UPDATE' && resource === 'role') return `Role assign user to role`;
  return `${action} ${resource}`;
}

export interface AuditSeedContext {
  users: SeedUsersResult;
  daysBack: number;
  count: number;
}

export async function seedAuditLogs(
  prisma: PrismaClient,
  ctx: AuditSeedContext
): Promise<number> {
  const { users, daysBack, count } = ctx;
  const userIds = users.users.map((u) => u.id);
  if (userIds.length === 0) return 0;

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  const created: Array<{
    userId: string;
    action: (typeof ACTIONS)[number];
    resource: string;
    resourceId: string | null;
    description: string;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < count; i++) {
    const action = pickOne([...ACTIONS]);
    const resource = pickOne(RESOURCES);
    const userId = pickOne(userIds);
    const createdAt = randomDateBetween(start, end);
    const description = pickDescription(action, resource, i);
    created.push({
      userId,
      action,
      resource,
      resourceId: action === 'VIEW' || action === 'CREATE' || action === 'UPDATE' ? `res-${i}` : null,
      description,
      createdAt,
    });
  }

  await prisma.auditLog.createMany({
    data: created.map((c) => ({
      userId: c.userId,
      action: c.action,
      resource: c.resource,
      resourceId: c.resourceId,
      description: c.description,
      createdAt: c.createdAt,
    })),
  });

  return created.length;
}
