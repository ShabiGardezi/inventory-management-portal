'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
}

interface TransferStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  onSuccess: () => void;
}

export function TransferStockModal({
  open,
  onOpenChange,
  sourceWarehouseId,
  sourceWarehouseName,
  onSuccess,
}: TransferStockModalProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [productId, setProductId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId('');
    setToWarehouseId('');
    setQuantity('');
    setNotes('');
    setLoading(true);
    Promise.all([
      fetch('/api/products?limit=500').then((r) => r.json()),
      fetch('/api/warehouses?limit=100').then((r) => r.json()),
    ])
      .then(([productsRes, whRes]) => {
        setProducts((productsRes as { products?: ProductOption[] }).products ?? []);
        const list = (whRes as { list?: WarehouseOption[] }).list ?? [];
        setWarehouses(list.filter((w: WarehouseOption) => w.id !== sourceWarehouseId));
      })
      .catch(() => {
        setProducts([]);
        setWarehouses([]);
      })
      .finally(() => setLoading(false));
  }, [open, sourceWarehouseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(quantity, 10);
    if (!productId || !toWarehouseId || Number.isNaN(q) || q <= 0) {
      toast({ title: 'Validation error', description: 'Select product, destination warehouse, and a positive quantity.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId,
          quantity: q,
          notes: notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Error', description: data.error ?? 'Failed to transfer stock', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: data.message ?? 'Stock transferred.' });
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to transfer stock', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>From warehouse</Label>
            <Input value={sourceWarehouseName} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId} required disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To warehouse</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId} required disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} {w.code ? `(${w.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity to transfer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || warehouses.length === 0}>
              {submitting ? 'Transferring…' : 'Transfer Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
