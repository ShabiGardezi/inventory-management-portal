'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LeadCreateClientObjectSchema, leadRefinements, type LeadCreateInput } from '@/lib/leads/schema';
import { LEAD_COUNTRY_OPTIONS } from '@/lib/leads/constants';
import { trackEvent } from '@/lib/analytics/track';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ContactFormSchema = LeadCreateClientObjectSchema.extend({
  type: z.literal('CONTACT'),
  company: z.string().min(2).max(140).optional(),
  phone: z.string().min(6).max(30).optional(),
}).superRefine(leadRefinements);

type ContactFormValues = z.infer<typeof ContactFormSchema>;

export function ContactForm() {
  const pathname = usePathname() ?? '/contact';
  const searchParams = useSearchParams();

  const utmSource = searchParams.get('utm_source') ?? undefined;
  const utmMedium = searchParams.get('utm_medium') ?? undefined;
  const utmCampaign = searchParams.get('utm_campaign') ?? undefined;

  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      type: 'CONTACT',
      name: '',
      email: '',
      phone: '',
      company: '',
      country: 'EU',
      companySize: undefined,
      message: '',
      marketingOptIn: false,
      consentAccepted: false,
      utmSource,
      utmMedium,
      utmCampaign,
      pagePath: pathname,
      website: '',
    },
    mode: 'onTouched',
  });

  async function onSubmit(values: ContactFormValues) {
    setApiError(null);
    const payload: LeadCreateInput = {
      type: 'CONTACT',
      name: values.name,
      email: values.email,
      phone: values.phone?.trim() ? values.phone : undefined,
      company: values.company?.trim() ? values.company : undefined,
      country: values.country,
      companySize: values.companySize,
      message: values.message,
      marketingOptIn: Boolean(values.marketingOptIn),
      consentAccepted: values.consentAccepted,
      utmSource: values.utmSource,
      utmMedium: values.utmMedium,
      utmCampaign: values.utmCampaign,
      pagePath: values.pagePath,
      website: values.website,
    };

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setApiError(data?.error ?? 'Something went wrong. Please try again.');
      return;
    }

    setSuccess(true);
    trackEvent('contact_submitted', { country: payload.country });
  }

  if (success) {
    return (
      <div className="rounded-lg border bg-muted/20 p-5">
        <div className="text-sm font-semibold">Thanks! We’ll contact you within 24 hours.</div>
        <p className="mt-2 text-sm text-muted-foreground">
          If you’d like a guided walkthrough, you can also <a className="underline" href="/demo">book a demo</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...form.register('name')} autoComplete="name" />
          {form.formState.errors.name?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" {...form.register('email')} autoComplete="email" inputMode="email" />
          {form.formState.errors.email?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...form.register('phone')} autoComplete="tel" inputMode="tel" placeholder="+44…" />
          {form.formState.errors.phone?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" {...form.register('company')} autoComplete="organization" />
          {form.formState.errors.company?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Country/Region</Label>
        <Select
          value={form.watch('country')}
          onValueChange={(v) => form.setValue('country', v, { shouldValidate: true, shouldTouch: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_COUNTRY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.country?.message ? (
          <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" {...form.register('message')} placeholder="How can we help?" />
        {form.formState.errors.message?.message ? (
          <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
        ) : null}
      </div>

      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...form.register('website')} />

      <div className="flex items-start gap-2">
        <Checkbox
          checked={form.watch('consentAccepted')}
          onCheckedChange={(v) => form.setValue('consentAccepted', v === true, { shouldValidate: true, shouldTouch: true })}
          id="consentAccepted"
        />
        <Label htmlFor="consentAccepted" className="text-sm leading-5">
          I agree to the <a className="underline" href="/privacy">Privacy Policy</a> and consent to being contacted.
        </Label>
      </div>
      {form.formState.errors.consentAccepted?.message ? (
        <p className="text-xs text-destructive">{form.formState.errors.consentAccepted.message}</p>
      ) : null}

      {apiError ? <p className="text-sm text-destructive">{apiError}</p> : null}

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Submitting…' : 'Send message'}
      </Button>
    </form>
  );
}

