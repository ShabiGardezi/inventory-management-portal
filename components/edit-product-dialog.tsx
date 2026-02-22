'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const editProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  unit: z.string().max(50),
  price: z.number().positive().optional().nullable(),
  reorderLevel: z.number().int().min(0, 'Must be 0 or more').optional().nullable(),
  isActive: z.boolean(),
});

type EditProductFormData = z.infer<typeof editProductSchema>;

export interface ProductForEdit {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  price: number | null;
  reorderLevel: number | null;
  isActive: boolean;
}

interface EditProductDialogProps {
  product: ProductForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditProductDialog({ product, open, onOpenChange, onSuccess }: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema) as Resolver<EditProductFormData>,
    defaultValues: {
      name: '',
      description: '',
      category: '',
      unit: 'pcs',
      price: null,
      reorderLevel: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (product && open) {
      reset({
        name: product.name,
        description: product.description ?? '',
        category: product.category ?? '',
        unit: product.unit,
        price: product.price != null ? Number(product.price) : null,
        reorderLevel: product.reorderLevel ?? null,
        isActive: product.isActive,
      });
    }
  }, [product, open, reset]);

  const onSubmit = async (data: EditProductFormData) => {
    if (!product) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          category: data.category || null,
          unit: data.unit,
          price: data.price,
          reorderLevel: data.reorderLevel ?? null,
          isActive: data.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update product');
      }
      toast({ title: 'Success', description: 'Product updated.' });
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update product',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>
            Update {product.name} ({product.sku}). SKU cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" {...register('name')} className={errors.name ? 'border-destructive' : ''} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input id="edit-description" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input id="edit-category" {...register('category')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input id="edit-unit" {...register('unit')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                {...register('price', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reorderLevel">Reorder level</Label>
              <Input
                id="edit-reorderLevel"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 10"
                {...register('reorderLevel', { setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? null : Number(v)) })}
                className={errors.reorderLevel ? 'border-destructive' : ''}
              />
              {errors.reorderLevel && <p className="text-sm text-destructive">{errors.reorderLevel.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="edit-isActive" {...register('isActive')} className="rounded" />
            <Label htmlFor="edit-isActive">Active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
