import { prisma } from '@/lib/prisma';
import type { AuditLogAction, Prisma } from '@prisma/client';

export interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  createdAt: Date;
  userEmail: string | null;
  userName: string | null;
}

export async function getAuditLogsByUserId(
  userId: string,
  skip: number,
  pageSize: number
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.auditLog.count({ where: { userId } }),
  ]);
  return {
    rows: rows.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      description: a.description,
      createdAt: a.createdAt,
      userEmail: a.user?.email ?? null,
      userName: a.user?.name ?? null,
    })),
    total,
  };
}

export interface AuditLogInput {
  userId: string | null;
  action: AuditLogAction;
  resource: string;
  resourceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Redact keys that may contain secrets from metadata for audit storage */
const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'secret', 'apiKey'];

function redactMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => keyLower.includes(s))) {
      out[k] = '[REDACTED]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = redactMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function createAuditLog(input: AuditLogInput): Promise<{ id: string }> {
  const raw = input.metadata ? redactMetadata(input.metadata as Record<string, unknown>) : null;
  const metadataValue: Prisma.InputJsonValue | undefined = raw === null ? undefined : (raw as Prisma.InputJsonValue);
  const log = await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      description: input.description ?? null,
      metadata: metadataValue,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: { id: true },
  });
  return log;
}

export async function logSettingsChange(
  userId: string,
  resource: string,
  resourceId: string | null,
  description: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  await createAuditLog({
    userId,
    action: 'UPDATE',
    resource,
    resourceId,
    description,
    metadata: {
      before: before ? redactMetadata(before) : null,
      after: after ? redactMetadata(after) : null,
    },
  });
}

export async function logProfileChange(
  userId: string,
  description: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Promise<void> {
  await createAuditLog({
    userId,
    action: 'UPDATE',
    resource: 'user_profile',
    resourceId: userId,
    description,
    metadata: {
      before: before ? redactMetadata(before) : null,
      after: after ? redactMetadata(after) : null,
    },
  });
}
