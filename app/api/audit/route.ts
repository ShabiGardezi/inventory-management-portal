import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AuditLogAction, Prisma } from '@prisma/client';
import { requireAnyPermission, createErrorResponse, createSuccessResponse } from '@/lib/rbac';

const AUDIT_ACTIONS: AuditLogAction[] = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'PERMISSION_DENIED'];

export async function GET(request: NextRequest) {
  try {
    await requireAnyPermission(['audit.read', 'audit:read']);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const dateFrom = searchParams.get('dateFrom') ?? undefined;
    const dateTo = searchParams.get('dateTo') ?? undefined;
    const actionParam = searchParams.get('action') ?? undefined;
    const resource = searchParams.get('resource') ?? undefined;

    const where: Prisma.AuditLogWhereInput = {};

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    if (actionParam && AUDIT_ACTIONS.includes(actionParam as AuditLogAction)) {
      where.action = actionParam as AuditLogAction;
    }
    if (resource) where.resource = resource;

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const logs = rows.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
      userEmail: a.user?.email ?? null,
      userName: a.user?.name ?? null,
    }));

    return createSuccessResponse({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden:')) {
        return createErrorResponse(error.message, 403);
      }
    }
    console.error('Audit API error:', error);
    return createErrorResponse('Failed to load audit logs', 500);
  }
}
