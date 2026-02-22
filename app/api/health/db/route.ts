import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/health/db
 * Checks database connectivity. Use this on Vercel to verify DATABASE_URL/DIRECT_URL.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, database: 'error', error: message },
      { status: 503 }
    );
  }
}
