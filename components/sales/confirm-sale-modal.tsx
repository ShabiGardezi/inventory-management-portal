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

interface BatchOption {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  mfgDate: string | null;
  availableQty: number;
}

interface SerialOption {
  id: string;
  serialNumber: string;
}

export interface ConfirmLineItem {
  productId: string;
  warehouseId: string;
  quantity: number;
  batchId: string;
  selectedSerialNumbers: string[];
}

interface ConfirmSaleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmSaleModal({ open, onClose, onSuccess }: ConfirmSaleModalProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [lines, setLines] = useState<ConfirmLineItem[]>([
    { productId: '', warehouseId: '', quantity: 0, batchId: '', selectedSerialNumbers: [] },
  ]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      { productId: '', warehouseId: '', quantity: 0, batchId: '', selectedSerialNumbers: [] },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateLine = (index: number, patch: Partial<ConfirmLineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const validate = (): string | null => {
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
      if (product?.trackBatches && !line.batchId) {
        return `Row ${i + 1}: Select a batch for this product.`;
      }
      if (product?.trackSerials && line.selectedSerialNumbers.length !== qty) {
        return `Row ${i + 1}: Select exactly ${qty} serial(s) (selected ${line.selectedSerialNumbers.length}).`;
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
    try {
      const payload = lines
        .filter((l) => l.productId && l.warehouseId && Number(l.quantity) > 0)
        .map((l) => {
          const product = getProduct(l.productId);
          return {
            productId: l.productId,
            warehouseId: l.warehouseId,
            quantity: Number(l.quantity),
            batchId: product?.trackBatches && l.batchId ? l.batchId : undefined,
            serialNumbers: product?.trackSerials && l.selectedSerialNumbers.length
              ? l.selectedSerialNumbers
              : undefined,
          };
        });

      const res = await fetch('/api/sales/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items: payload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Confirm failed', description: data.error || res.statusText, variant: 'destructive' });
        return;
      }
      if (res.status === 202 && data.pendingApproval) {
        toast({
          title: 'Sent for approval',
          description: data.message ?? 'Sale confirm submitted for approval.',
        });
        onClose();
        onSuccess();
        return;
      }
      toast({ title: 'Sale confirmed', description: `${data.itemsConfirmed ?? payload.length} item(s) confirmed.` });
      onClose();
      onSuccess();
    } catch {
      toast({ title: 'Error', description: 'Request failed.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setLines([{ productId: '', warehouseId: '', quantity: 0, batchId: '', selectedSerialNumbers: [] }]);
    setReferenceNumber('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm sale</DialogTitle>
          <DialogDescription>
            Record sale fulfillment (OUT). For batch/serial products, select batch and serials per line.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Reference (optional)</Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="SO-12345"
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
                <ConfirmLineRow
                  key={idx}
                  line={line}
                  lineIndex={idx}
                  products={products}
                  warehouses={warehouses}
                  getProduct={getProduct}
                  onUpdate={(patch) => updateLine(idx, patch)}
                  onRemove={() => removeLine(idx)}
                  canRemove={lines.length > 1}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Confirming…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmLineRow({
  line,
  lineIndex,
  products,
  warehouses,
  getProduct,
  onUpdate,
  onRemove,
  canRemove,
}: {
  line: ConfirmLineItem;
  lineIndex: number;
  products: ProductOption[];
  warehouses: WarehouseOption[];
  getProduct: (id: string) => ProductOption | undefined;
  onUpdate: (patch: Partial<ConfirmLineItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [serials, setSerials] = useState<SerialOption[]>([]);
  const product = getProduct(line.productId);

  useEffect(() => {
    if (!line.productId || !line.warehouseId) {
      setBatches([]);
      setSerials([]);
      return;
    }
    const params = new URLSearchParams({ productId: line.productId, warehouseId: line.warehouseId });
    fetch(`/api/stock/batches?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBatches(d?.batches ?? []))
      .catch(() => setBatches([]));
  }, [line.productId, line.warehouseId]);

  useEffect(() => {
    if (!line.productId || !line.warehouseId || !product?.trackSerials) {
      setSerials([]);
      return;
    }
    const params = new URLSearchParams({ productId: line.productId, warehouseId: line.warehouseId });
    if (line.batchId) params.set('batchId', line.batchId);
    fetch(`/api/stock/serials?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSerials(d?.serials ?? []))
      .catch(() => setSerials([]));
  }, [line.productId, line.warehouseId, line.batchId, product?.trackSerials]);

  const toggleSerial = (serialNumber: string) => {
    const qty = Number(line.quantity);
    const current = line.selectedSerialNumbers;
    if (current.includes(serialNumber)) {
      onUpdate({ selectedSerialNumbers: current.filter((s) => s !== serialNumber) });
    } else if (current.length < qty) {
      onUpdate({ selectedSerialNumbers: [...current, serialNumber] });
    }
  };

  return (
    <div className="p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Row {lineIndex + 1}</span>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Product</Label>
          <select
            value={line.productId}
            onChange={(e) => onUpdate({ productId: e.target.value, batchId: '', selectedSerialNumbers: [] })}
            className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Select</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Warehouse</Label>
          <select
            value={line.warehouseId}
            onChange={(e) => onUpdate({ warehouseId: e.target.value, batchId: '', selectedSerialNumbers: [] })}
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
            onChange={(e) => onUpdate({ quantity: e.target.value === '' ? 0 : Number(e.target.value), selectedSerialNumbers: [] })}
            className="mt-0.5 h-9"
          />
        </div>
      </div>
      {product?.trackBatches && (
        <div>
          <Label className="text-xs">Batch *</Label>
          <select
            value={line.batchId}
            onChange={(e) => onUpdate({ batchId: e.target.value, selectedSerialNumbers: [] })}
            className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNumber} (exp: {b.expiryDate ?? '—'}, avail: {b.availableQty})
              </option>
            ))}
          </select>
        </div>
      )}
      {product?.trackSerials && (
        <div>
          <Label className="text-xs">Serials (select {line.quantity})</Label>
          <div className="mt-0.5 max-h-32 overflow-y-auto rounded border border-input bg-background p-2 flex flex-wrap gap-1">
            {serials.map((s) => {
              const selected = line.selectedSerialNumbers.includes(s.serialNumber);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSerial(s.serialNumber)}
                  className={`rounded px-2 py-0.5 text-xs border ${
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                >
                  {s.serialNumber}
                </button>
              );
            })}
            {serials.length === 0 && (
              <span className="text-xs text-muted-foreground">No IN_STOCK serials in this warehouse{line.batchId ? ' for selected batch' : ''}.</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selected: {line.selectedSerialNumbers.length} / {line.quantity}
          </p>
        </div>
      )}
    </div>
  );
}
