'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { NotificationPrefs } from '@/lib/settings-types';

const schema = z.object({
  lowStockNotificationsEnabled: z.boolean(),
  dailySummaryEmailEnabled: z.boolean(),
  weeklySummaryEmailEnabled: z.boolean(),
  notificationRecipientEmails: z.array(z.string().email()),
  inAppNotificationsEnabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface NotificationsSectionProps {
  data: NotificationPrefs;
  canUpdate: boolean;
  onSaved: () => void;
}

export function NotificationsSection({ data, canUpdate, onSaved }: NotificationsSectionProps) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lowStockNotificationsEnabled: data.lowStockNotificationsEnabled,
      dailySummaryEmailEnabled: data.dailySummaryEmailEnabled,
      weeklySummaryEmailEnabled: data.weeklySummaryEmailEnabled,
      notificationRecipientEmails: data.notificationRecipientEmails,
      inAppNotificationsEnabled: data.inAppNotificationsEnabled,
    },
  });

  const recipientsStr = form.watch('notificationRecipientEmails').join(', ');

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications: {
            lowStockNotificationsEnabled: values.lowStockNotificationsEnabled,
            dailySummaryEmailEnabled: values.dailySummaryEmailEnabled,
            weeklySummaryEmailEnabled: values.weeklySummaryEmailEnabled,
            notificationRecipientEmails: values.notificationRecipientEmails,
            inAppNotificationsEnabled: values.inAppNotificationsEnabled,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: json.error ?? 'Failed to save', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Notification preferences saved' });
      onSaved();
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
  };

  if (!canUpdate) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">You don&apos;t have access to notification settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Low stock alerts, summary emails, and in-app notifications. Recipient list is stored; email sending can be
          wired later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lowStockNotificationsEnabled"
              {...form.register('lowStockNotificationsEnabled')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="lowStockNotificationsEnabled">Low stock notifications enabled</Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dailySummaryEmailEnabled"
              {...form.register('dailySummaryEmailEnabled')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="dailySummaryEmailEnabled">Daily summary email</Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="weeklySummaryEmailEnabled"
              {...form.register('weeklySummaryEmailEnabled')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="weeklySummaryEmailEnabled">Weekly summary email</Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="inAppNotificationsEnabled"
              {...form.register('inAppNotificationsEnabled')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="inAppNotificationsEnabled">In-app notifications</Label>
          </div>

          <div className="space-y-2">
            <Label>Recipient emails (comma-separated)</Label>
            <Input
              value={recipientsStr}
              onChange={(e) => {
                const emails = e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                form.setValue('notificationRecipientEmails', emails, { shouldDirty: true });
              }}
              placeholder="admin@example.com, manager@example.com"
            />
            {form.formState.errors.notificationRecipientEmails && (
              <p className="text-sm text-destructive">
                {typeof form.formState.errors.notificationRecipientEmails.message === 'string'
                  ? form.formState.errors.notificationRecipientEmails.message
                  : 'Invalid email in list'}
              </p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save notification preferences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
