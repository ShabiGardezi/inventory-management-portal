import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth, hasRole, createErrorResponse, createSuccessResponse } from '@/lib/rbac';

const execAsync = promisify(exec);

/**
 * POST /api/dev/seed
 * Dev-only: trigger database seed. Requires NODE_ENV=development and Admin role.
 * Body: { "reset": true } (default) = wipe then seed; { "reset": false } = seed-if-empty.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return createErrorResponse('Not available outside development', 404);
  }

  try {
    const user = await requireAuth();
    if (!hasRole(user, 'admin')) {
      return createErrorResponse('Forbidden: Admin role required', 403);
    }

    const body = await request.json().catch(() => ({}));
    const reset = Boolean((body as { reset?: boolean }).reset ?? true);

    const cmd = reset ? 'npx tsx prisma/seed.ts --reset' : 'npx tsx prisma/seed.ts';
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    return createSuccessResponse(
      {
        ok: true,
        mode: reset ? 'reset-and-seed' : 'seed-if-empty',
        stdout: stdout.slice(-2000),
        stderr: stderr.slice(-1000),
      },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return createErrorResponse('Unauthorized', 401);
      }
      if (error.message.includes('Forbidden')) {
        return createErrorResponse(error.message, 403);
      }
      console.error('Dev seed error:', error);
      return createErrorResponse(error.message, 500);
    }
    return createErrorResponse('Seed failed', 500);
  }
}
