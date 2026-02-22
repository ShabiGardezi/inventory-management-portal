'use client';

import { useEffect } from 'react';
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
import type { InventoryRules } from '@/lib/settings-types';

const schema = z.object({
  allowNegativeStock: z.boolean(),
  enforceReorderLevelAlerts: z.boolean(),
  defaultWarehouseId: z.string().nullable(),
  stockAdjustmentReasons: z.array(z.string()),
  enableBarcode: z.boolean(),
  quantityPrecision: z.enum(['integer', 'decimal']),
  lowStockThresholdBehavior: z.enum(['reorderLevel', 'globalThreshold']),
});

type FormValues = z.infer<typeof schema>;

interface InventorySectionProps {
  data: InventoryRules;
  canUpdate: boolean;
  warehouses: { id: string; name: string }[];
  onSaved: () => void;
}

export function InventorySection({ data, canUpdate, warehouses, onSaved }: InventorySectionProps) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      allowNegativeStock: data.allowNegativeStock,
      enforceReorderLevelAlerts: data.enforceReorderLevelAlerts,
      defaultWarehouseId: data.defaultWarehouseId ?? '',
      stockAdjustmentReasons: data.stockAdjustmentReasons,
      enableBarcode: data.enableBarcode,
      quantityPrecision: data.quantityPrecision as 'integer' | 'decimal',
      lowStockThresholdBehavior: data.lowStockThresholdBehavior as 'reorderLevel' | 'globalThreshold',
    },
  });

  useEffect(() => {
    form.reset({
      allowNegativeStock: data.allowNegativeStock,
      enforceReorderLevelAlerts: data.enforceReorderLevelAlerts,
      defaultWarehouseId: data.defaultWarehouseId ?? '',
      stockAdjustmentReasons: data.stockAdjustmentReasons,
      enableBarcode: data.enableBarcode,
      quantityPrecision: data.quantityPrecision as 'integer' | 'decimal',
      lowStockThresholdBehavior: data.lowStockThresholdBehavior as 'reorderLevel' | 'globalThreshold',
    });
  }, [data, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: {
            allowNegativeStock: values.allowNegativeStock,
            enforceReorderLevelAlerts: values.enforceReorderLevelAlerts,
            defaultWarehouseId: values.defaultWarehouseId || null,
            stockAdjustmentReasons: values.stockAdjustmentReasons,
            enableBarcode: values.enableBarcode,
            quantityPrecision: values.quantityPrecision,
            lowStockThresholdBehavior: values.lowStockThresholdBehavior,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: json.error ?? 'Failed to save', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Inventory rules saved' });
      onSaved();
    } catch {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
  };

  if (!canUpdate) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">You don&apos;t have access to inventory settings.</p>
        </CardContent>
      </Card>
    );
  }

  const reasonsStr = form.watch('stockAdjustmentReasons').join(', ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Rules</CardTitle>
        <CardDescription>Stock behavior, defaults, and low-stock alerts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowNegativeStock"
              {...form.register('allowNegativeStock')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="allowNegativeStock">Allow negative stock</Label>
          </div>
          {form.formState.errors.allowNegativeStock && (
            <p className="text-sm text-destructive">{form.formState.errors.allowNegativeStock.message}</p>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enforceReorderLevelAlerts"
              {...form.register('enforceReorderLevelAlerts')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="enforceReorderLevelAlerts">Enforce reorder level alerts</Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableBarcode"
              {...form.register('enableBarcode')}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="enableBarcode">Enable barcode support</Label>
          </div>

          <div className="space-y-2">
            <Label>Default warehouse</Label>
            <Select
              value={form.watch('defaultWarehouseId') || 'none'}
              onValueChange={(v) => form.setValue('defaultWarehouseId', v === 'none' ? '' : v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity precision</Label>
            <Select
              value={form.watch('quantityPrecision')}
              onValueChange={(v) => form.setValue('quantityPrecision', v as 'integer' | 'decimal', { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="decimal">Decimal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Low stock threshold behavior</Label>
            <Select
              value={form.watch('lowStockThresholdBehavior')}
              onValueChange={(v) =>
                form.setValue('lowStockThresholdBehavior', v as 'reorderLevel' | 'globalThreshold', {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reorderLevel">Use product reorder level</SelectItem>
                <SelectItem value="globalThreshold">Use global threshold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Stock adjustment reasons (comma-separated)</Label>
            <Input
              value={reasonsStr}
              onChange={(e) =>
                form.setValue(
                  'stockAdjustmentReasons',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  { shouldDirty: true }
                )
              }
              placeholder="Count correction, Damage, Found, Other"
            />
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting ? 'Saving…' : 'Save inventory rules'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
