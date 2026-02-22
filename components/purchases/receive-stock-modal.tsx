'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  trackBatches: boolean;
  trackSerials: boolean;
}

interface WarehouseOption {
  id: string;
  name: string;
}

export interface ReceiveLineItem {
  productId: string;
  warehouseId: string;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  mfgDate: string;
  serialsText: string;
}

function parseSerials(text: string): string[] {
  const raw = text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(raw)];
}

interface ReceiveStockModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReceiveStockModal({ open, onClose, onSuccess }: ReceiveStockModalProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [lines, setLines] = useState<ReceiveLineItem[]>([
    { productId: '', warehouseId: '', quantity: 0, batchNumber: '', expiryDate: '', mfgDate: '', serialsText: '' },
  ]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successSummary, setSuccessSummary] = useState<{
    itemsReceived: number;
    batchesCreated: number;
    serialsCreated: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/products?limit=500')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.products) {
          setProducts(
            d.products.map((p: { id: string; name: string; sku: string; trackBatches?: boolean; trackSerials?: boolean }) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              trackBatches: !!p.trackBatches,
              trackSerials: !!p.trackSerials,
            }))
          );
        }
      })
      .catch(() => setProducts([]));
    fetch('/api/warehouses?limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.list) {
          setWarehouses(d.list.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })));
        }
      })
      .catch(() => setWarehouses([]));
  }, [open]);

  const getProduct = useCallback(
    (productId: string) => products.find((p) => p.id === productId),
    [products]
  );

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { productId: '', warehouseId: '', quantity: 0, batchNumber: '', expiryDate: '', mfgDate: '', serialsText: '' },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateLine = (index: number, patch: Partial<ReceiveLineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const validate = (): string | null => {
    const allSerials: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId || !line.warehouseId) {
        return `Row ${i + 1}: Select product and warehouse.`;
      }
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return `Row ${i + 1}: Enter a positive quantity.`;
      }
      const product = getProduct(line.productId);
      if (product?.trackBatches && !line.batchNumber?.trim()) {
        return `Row ${i + 1}: Batch number is required for this product.`;
      }
      if (product?.trackSerials) {
        const serials = parseSerials(line.serialsText);
        if (serials.length !== qty) {
          return `Row ${i + 1}: Enter exactly ${qty} serial number(s) (found ${serials.length}).`;
        }
        const dup = serials.find((s) => allSerials.includes(s));
        if (dup) return `Row ${i + 1}: Duplicate serial "${dup}" in this receive.`;
        allSerials.push(...serials);
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: 'Validation error', description: err, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setSuccessSummary(null);
    try {
      const items = lines
        .filter((l) => l.productId && l.warehouseId && Number(l.quantity) > 0)
        .map((l) => {
          const product = getProduct(l.productId);
          const qty = Number(l.quantity);
          const serials = product?.trackSerials ? parseSerials(l.serialsText) : undefined;
          const batchInput =
            product?.trackBatches && l.batchNumber?.trim()
              ? {
                  batchNumber: l.batchNumber.trim(),
                  expiryDate: l.expiryDate?.trim() || undefined,
                  mfgDate: l.mfgDate?.trim() || undefined,
                }
              : undefined;
          return {
            productId: l.productId,
            warehouseId: l.warehouseId,
            quantity: qty,
            batchInput: batchInput ?? undefined,
            serialNumbers: serials,
          };
        });

      const res = await fetch('/api/purchases/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Receive failed', description: data.error || res.statusText, variant: 'destructive' });
        return;
      }
      if (res.status === 202 && data.pendingApproval) {
        toast({
          title: 'Sent for approval',
          description: data.message ?? 'Receive request submitted for approval.',
        });
        handleClose();
        onSuccess();
        return;
      }
      setSuccessSummary({
        itemsReceived: data.itemsReceived ?? items.length,
        batchesCreated: data.batchesCreated ?? 0,
        serialsCreated: data.serialsCreated ?? 0,
      });
      toast({ title: 'Stock received', description: `${data.itemsReceived ?? items.length} item(s) received.` });
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccessSummary(null);
    setLines([{ productId: '', warehouseId: '', quantity: 0, batchNumber: '', expiryDate: '', mfgDate: '', serialsText: '' }]);
    setReferenceNumber('');
    setNotes('');
    onClose();
  };

  const handleDone = () => {
    handleClose();
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            Record purchase receive (IN). For batch/serial products, fill batch and serial details per line.
          </DialogDescription>
        </DialogHeader>

        {successSummary ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="font-medium">Receive summary</p>
              <ul className="text-sm text-muted-foreground">
                <li>Items received: {successSummary.itemsReceived}</li>
                <li>Batches created: {successSummary.batchesCreated}</li>
                <li>Serials created: {successSummary.serialsCreated}</li>
              </ul>
            </div>
            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Reference (optional)</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="PO-12345"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add line
                </Button>
              </div>
              <div className="rounded-md border divide-y max-h-[50vh] overflow-y-auto">
                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Row {idx + 1}</span>
                      {lines.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Product</Label>
                        <select
                          value={line.productId}
                          onChange={(e) => updateLine(idx, { productId: e.target.value })}
                          className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Select</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Warehouse</Label>
                        <select
                          value={line.warehouseId}
                          onChange={(e) => updateLine(idx, { warehouseId: e.target.value })}
                          className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Select</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="1"
                          value={line.quantity || ''}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                          className="mt-0.5 h-9"
                        />
                      </div>
                    </div>
                    {getProduct(line.productId)?.trackBatches && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Batch number *</Label>
                          <Input
                            value={line.batchNumber}
                            onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                            placeholder="Required"
                            className="mt-0.5 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Expiry (optional)</Label>
                          <Input
                            type="date"
                            value={line.expiryDate}
                            onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                            className="mt-0.5 h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Mfg date (optional)</Label>
                          <Input
                            type="date"
                            value={line.mfgDate}
                            onChange={(e) => updateLine(idx, { mfgDate: e.target.value })}
                            className="mt-0.5 h-9"
                          />
                        </div>
                      </div>
                    )}
                    {getProduct(line.productId)?.trackSerials && (
                      <div>
                        <Label className="text-xs">Serial numbers (one per line or comma-separated, count must equal qty)</Label>
                        <textarea
                          value={line.serialsText}
                          onChange={(e) => updateLine(idx, { serialsText: e.target.value })}
                          placeholder="SN1&#10;SN2&#10;..."
                          rows={2}
                          className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        />
                        {line.serialsText && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Parsed: {parseSerials(line.serialsText).length} serial(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Receiving…' : 'Receive'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
