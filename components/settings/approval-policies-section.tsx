'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck } from 'lucide-react';

type EntityType = 'PURCHASE_RECEIVE' | 'SALE_CONFIRM' | 'STOCK_ADJUSTMENT' | 'STOCK_TRANSFER';

interface PolicyRow {
  entityType: EntityType;
  id: string | null;
  isEnabled: boolean;
  requiredPermission: string;
  minAmount: number | null;
  warehouseScopeId: string | null;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  PURCHASE_RECEIVE: 'Purchase receive',
  SALE_CONFIRM: 'Sale confirm',
  STOCK_ADJUSTMENT: 'Stock adjustment',
  STOCK_TRANSFER: 'Stock transfer',
};

const DEFAULT_PERMISSION = 'approvals.review';

export function ApprovalPoliciesSection() {
  const { toast } = useToast();
  const [list, setList] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/approvals/policies');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setList(data.list ?? []);
    } catch {
      toast({ title: 'Error', description: 'Could not load approval policies.', variant: 'destructive' });
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const updateLocal = (entityType: EntityType, patch: Partial<PolicyRow>) => {
    setList((prev) =>
      prev.map((p) => (p.entityType === entityType ? { ...p, ...patch } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/approvals/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list: list.map((p) => ({
            entityType: p.entityType,
            isEnabled: p.isEnabled,
            requiredPermission: p.requiredPermission || DEFAULT_PERMISSION,
            minAmount: p.entityType === 'PURCHASE_RECEIVE' ? p.minAmount : undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? res.statusText);
      }
      toast({ title: 'Saved', description: 'Approval policies updated.' });
      fetchPolicies();
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save policies.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Approval Policies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Approval Policies
        </CardTitle>
        <CardDescription>
          Require approval for stock-affecting actions. When enabled, requests are created and must be approved by a user with the reviewer permission before stock is changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {list.map((policy) => (
            <div
              key={policy.entityType}
              className="flex flex-wrap items-center gap-4 rounded-lg border p-4"
            >
              <div className="flex-1 min-w-[180px]">
                <Label className="font-medium">{ENTITY_LABELS[policy.entityType]}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, {policy.entityType.toLowerCase().replace(/_/g, ' ')} requires approval.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`enabled-${policy.entityType}`}
                  checked={policy.isEnabled}
                  onCheckedChange={(checked) => updateLocal(policy.entityType, { isEnabled: !!checked })}
                />
                <Label htmlFor={`enabled-${policy.entityType}`} className="text-sm font-normal cursor-pointer">Enabled</Label>
              </div>
              <div className="w-48">
                <Label className="text-xs">Reviewer permission</Label>
                <Input
                  value={policy.requiredPermission}
                  onChange={(e) => updateLocal(policy.entityType, { requiredPermission: e.target.value })}
                  placeholder={DEFAULT_PERMISSION}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              {policy.entityType === 'PURCHASE_RECEIVE' && (
                <div className="w-36">
                  <Label className="text-xs">Min amount (optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={policy.minAmount ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateLocal(policy.entityType, { minAmount: v === '' ? null : Number(v) });
                    }}
                    placeholder="0"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save policies'}
        </Button>
      </CardContent>
    </Card>
  );
}
