import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LeadCreateSchema } from '@/lib/leads/schema';
import { normalizePhone, sanitizeMultiLine, sanitizeSingleLine } from '@/lib/leads/sanitize';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sendLeadNotificationEmail } from '@/lib/email/send-lead-notification';
import { absoluteUrl } from '@/lib/seo/site';

function getClientIp(request: NextRequest): string | undefined {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  return realIp ?? undefined;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request) ?? 'unknown';
    const rl = checkRateLimit({ key: `leads:${ip}`, limit: 8, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) {
      return Response.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'retry-after': String(rl.retryAfterSeconds) } }
      );
    }

    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = LeadCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid submission. Please check the form and try again.' }, { status: 400 });
    }

    const input = parsed.data;

    const sanitized = {
      type: input.type,
      name: sanitizeSingleLine(input.name),
      email: sanitizeSingleLine(input.email).toLowerCase(),
      phone: input.phone ? normalizePhone(input.phone) : undefined,
      company: input.company ? sanitizeSingleLine(input.company) : undefined,
      country: sanitizeSingleLine(input.country),
      companySize: input.companySize ? sanitizeSingleLine(input.companySize) : undefined,
      message: sanitizeMultiLine(input.message),
      marketingOptIn: Boolean(input.marketingOptIn),
      consentAccepted: input.consentAccepted === true,
      utmSource: input.utmSource ? sanitizeSingleLine(input.utmSource) : undefined,
      utmMedium: input.utmMedium ? sanitizeSingleLine(input.utmMedium) : undefined,
      utmCampaign: input.utmCampaign ? sanitizeSingleLine(input.utmCampaign) : undefined,
      pagePath: sanitizeSingleLine(input.pagePath),
    };

    if (sanitized.phone && (sanitized.phone.length < 6 || sanitized.phone.length > 30)) {
      return Response.json({ error: 'Invalid phone number.' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        type: sanitized.type,
        name: sanitized.name,
        email: sanitized.email,
        phone: sanitized.phone,
        company: sanitized.company,
        country: sanitized.country,
        companySize: sanitized.companySize,
        message: sanitized.message,
        marketingOptIn: sanitized.marketingOptIn,
        consentAccepted: sanitized.consentAccepted,
        utmSource: sanitized.utmSource,
        utmMedium: sanitized.utmMedium,
        utmCampaign: sanitized.utmCampaign,
        pagePath: sanitized.pagePath,
      },
      select: { id: true, createdAt: true, type: true },
    });

    const adminUrl = absoluteUrl(`/admin/leads?leadId=${encodeURIComponent(lead.id)}`);
    try {
      await sendLeadNotificationEmail({
        type: lead.type,
        name: sanitized.name,
        email: sanitized.email,
        phone: sanitized.phone ?? null,
        company: sanitized.company ?? null,
        country: sanitized.country,
        companySize: sanitized.companySize ?? null,
        message: sanitized.message,
        marketingOptIn: sanitized.marketingOptIn,
        consentAccepted: sanitized.consentAccepted,
        utmSource: sanitized.utmSource ?? null,
        utmMedium: sanitized.utmMedium ?? null,
        utmCampaign: sanitized.utmCampaign ?? null,
        pagePath: sanitized.pagePath,
        createdAtIso: lead.createdAt.toISOString(),
        adminUrl,
      });
    } catch {
      // Lead is stored; email misconfig should not break the user flow.
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    return Response.json({ error: 'Server error. Please try again later.' }, { status: 500 });
  }
}

