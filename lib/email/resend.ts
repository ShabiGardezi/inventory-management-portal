import { Resend } from 'resend';

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(key);
}

export function getFromAddress(): string {
  return process.env.RESEND_FROM ?? 'onboarding@resend.dev';
}

