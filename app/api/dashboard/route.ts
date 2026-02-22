import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { createErrorResponse, createSuccessResponse } from '@/lib/rbac';
import { getDashboardData, type DashboardRange } from '@/server/services/dashboardService';
import { getFormatSettings } from '@/server/services/settingsService';

export const dynamic = 'force-dynamic';

const VALID_RANGES: DashboardRange[] = ['7d', '30d', '90d', 'custom'];

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') ?? '30d') as DashboardRange;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const resolvedRange = VALID_RANGES.includes(range) ? range : '30d';
    const options = resolvedRange === 'custom' ? { from: from ?? null, to: to ?? null } : undefined;

    const [data, formatSettings] = await Promise.all([
      getDashboardData(user, resolvedRange, 5, options),
      getFormatSettings(),
    ]);
    return createSuccessResponse({ ...data, formatSettings });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized: Authentication required') {
        return createErrorResponse('Unauthorized', 401);
      }
    }
    console.error('Dashboard API error:', error);
    return createErrorResponse('Failed to load dashboard', 500);
  }
}
