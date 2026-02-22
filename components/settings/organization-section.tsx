'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { OrganizationSettings } from '@/lib/settings-types';

const CURRENCIES = ['USD', 'PKR', 'EUR', 'GBP'] as const;
const DATE_FORMATS = ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'] as const;
const TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Karachi', 'Asia/Dubai'] as const;

const schema = z.object({
  companyName: z.string().max(255).optional(),
  businessEmail: z.string().max(255).refine((s) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), 'Invalid email').optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  timezone: z.string().max(100),
  currency: z.string().length(3),
  dateFormat: z.string().max(50),
  invoicePrefix: z.string().max(20).optional(),
  invoiceNumberPattern: z.string().max(100).optional(),
  defaultTaxRate: z.number().min(0).max(100).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

interface OrganizationSectionProps {
  data: OrganizationSettings;
  canUpdate: boolean;
  onSaved: () => void;
}

export function OrganizationSection({ data, canUpdate, onSaved }: OrganizationSectionProps) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: data.companyName ?? '',
      businessEmail: data.businessEmail ?? '',
      phone: data.phone ?? '',
      address: data.address ?? '',
      timezone: data.timezone,
      currency: data.currency,
      dateFormat: data.dateFormat,
      invoicePrefix: data.invoicePrefix ?? '',
      invoiceNumberPattern: data.invoiceNumberPattern ?? '',
      defaultTaxRate: data.defaultTaxRate ?? undefined,
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: {
            companyName: values.companyName?.trim() || null,
            businessEmail: values.businessEmail?.trim() || null,
            phone: values.phone?.trim() || null,
            address: values.address?.trim() || null,
            timezone: values.timezone,
            currency: values.currency,
            dateFormat: values.dateFormat,
            invoicePrefix: values.invoicePrefix?.trim() || null,
            invoiceNumberPattern: values.invoiceNumberPattern?.trim() || null,
            defaultTaxRate: values.defaultTaxRate ?? null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: json.error ?? 'Failed to save', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Organization settings saved' });
      onSaved();
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
  };

  if (!canUpdate) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">You don&apos;t have access to organization settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization / Business Settings</CardTitle>
        <CardDescription>Company details, locale, and invoice preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input {...form.register('companyName')} placeholder="Acme Inc." />
            </div>
            <div className="space-y-2">
              <Label>Business email</Label>
              <Input type="email" {...form.register('businessEmail')} placeholder="billing@example.com" />
              {form.formState.errors.businessEmail && (
                <p className="text-sm text-destructive">{form.formState.errors.businessEmail.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...form.register('phone')} placeholder="+1 234 567 8900" />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input {...form.register('address')} placeholder="Street, City, Country" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={form.watch('timezone')}
                onValueChange={(v) => form.setValue('timezone', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.watch('currency')}
                onValueChange={(v) => form.setValue('currency', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date format</Label>
              <Select
                value={form.watch('dateFormat')}
                onValueChange={(v) => form.setValue('dateFormat', v, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default tax rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...form.register('defaultTaxRate', { valueAsNumber: true })}
              />
              {form.formState.errors.defaultTaxRate && (
                <p className="text-sm text-destructive">{form.formState.errors.defaultTaxRate.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice prefix</Label>
              <Input {...form.register('invoicePrefix')} placeholder="INV-" />
            </div>
            <div className="space-y-2">
              <Label>Invoice number pattern</Label>
              <Input {...form.register('invoiceNumberPattern')} placeholder="INV-{YYYY}-{NUM}" />
            </div>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save organization settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
