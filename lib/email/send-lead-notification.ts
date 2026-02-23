import type { LeadType } from '@prisma/client';
import { getFromAddress, getResendClient } from '@/lib/email/resend';

const INTERNAL_RECIPIENT = 'shabigardezi51214@gmail.com';

export type LeadEmailPayload = {
  type: LeadType;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  country: string;
  companySize?: string | null;
  message: string;
  marketingOptIn: boolean;
  consentAccepted: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  pagePath: string;
  createdAtIso: string;
  adminUrl?: string;
};

function subjectForLead(input: LeadEmailPayload): string {
  if (input.type === 'DEMO') {
    return `[DEMO REQUEST] ${input.company ?? input.name} — ${input.country}`;
  }
  return `[CONTACT] ${input.name} — ${input.country}`;
}

function toText(input: LeadEmailPayload): string {
  return [
    `Type: ${input.type}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? '-'}`,
    `Company: ${input.company ?? '-'}`,
    `Country/Region: ${input.country}`,
    `Company size: ${input.companySize ?? '-'}`,
    `Marketing opt-in: ${input.marketingOptIn ? 'Yes' : 'No'}`,
    `Consent accepted: ${input.consentAccepted ? 'Yes' : 'No'}`,
    '',
    'Message:',
    input.message,
    '',
    'UTM:',
    `utm_source: ${input.utmSource ?? '-'}`,
    `utm_medium: ${input.utmMedium ?? '-'}`,
    `utm_campaign: ${input.utmCampaign ?? '-'}`,
    '',
    `Submitted from: ${input.pagePath}`,
    `Timestamp: ${input.createdAtIso}`,
    input.adminUrl ? `Admin: ${input.adminUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendLeadNotificationEmail(payload: LeadEmailPayload): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: getFromAddress(),
    to: [INTERNAL_RECIPIENT],
    subject: subjectForLead(payload),
    text: toText(payload),
  });
}

