import { z } from 'zod';
import { isGulfCountry } from '@/lib/leads/constants';

export const LeadTypeSchema = z.enum(['DEMO', 'CONTACT']);
export type LeadTypeValue = z.infer<typeof LeadTypeSchema>;

export const CompanySizeSchema = z.enum(['1-10', '11-50', '51-200', '200+']);
export type CompanySizeValue = z.infer<typeof CompanySizeSchema>;

const LeadCreateObjectSchema = z.object({
  type: LeadTypeSchema,
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  phone: z.string().min(6).max(30).optional(),
  company: z.string().min(2).max(140).optional(),
  country: z.string().min(2).max(40),
  companySize: CompanySizeSchema.optional(),
  message: z.string().min(5).max(4000),
  marketingOptIn: z.boolean().optional(),
  consentAccepted: z.boolean(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  pagePath: z.string().min(1).max(300),
  // anti-spam honeypot
  website: z.string().max(200).optional(),
});

export type LeadRefinementInput = {
  type: LeadTypeValue;
  company?: string;
  message: string;
  country: string;
  phone?: string;
  consentAccepted: boolean;
  website?: string;
};

export function leadRefinements(data: LeadRefinementInput, ctx: z.RefinementCtx) {
    if (data.type === 'DEMO') {
      if (!data.company) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['company'], message: 'Company name is required.' });
      }
      if (data.message.trim().length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: 'Please share a bit more detail (at least 20 characters).',
        });
      }
      if (isGulfCountry(data.country) && !data.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phone'],
          message: 'Phone number is required for Gulf region requests.',
        });
      }
    }

    if (data.type === 'CONTACT') {
      if (data.message.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['message'],
          message: 'Message is required.',
        });
      }
    }

    if (data.consentAccepted !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consentAccepted'],
        message: 'Consent is required.',
      });
    }

    if (data.website && data.website.trim().length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['website'], message: 'Invalid submission.' });
    }
}

export const LeadCreateSchema = LeadCreateObjectSchema.superRefine(leadRefinements);

export const LeadCreateClientObjectSchema = LeadCreateObjectSchema;
export const LeadCreateClientSchema = LeadCreateClientObjectSchema.superRefine(leadRefinements);

export type LeadCreateInput = z.infer<typeof LeadCreateSchema>;

