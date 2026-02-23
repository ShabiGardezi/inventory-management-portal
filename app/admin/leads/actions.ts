'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import type { LeadStatus } from '@prisma/client';

export async function updateLeadStatus(input: { id: string; status: LeadStatus }) {
  await requirePermission('leads.update');
  await prisma.lead.update({
    where: { id: input.id },
    data: { status: input.status },
    select: { id: true },
  });
  revalidatePath('/admin/leads');
}

