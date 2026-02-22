'use client';

import { useState } from 'react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const productSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU must be 100 characters or less')
    .regex(/^[A-Z0-9\-_]+$/, 'SKU must contain only uppercase letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Product name is required').max(255, 'Product name must be 255 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  category: z.string().max(100, 'Category must be 100 characters or less').optional(),
  unit: z.string().max(50, 'Unit must be 50 characters or less').default('pcs'),
  price: z
    .number()
    .positive('Price must be a positive number')
    .optional()
    .nullable(),
  reorderLevel: z.number().int().min(0, 'Reorder level must be 0 or more').optional().nullable(),
  isActive: z.boolean().default(true),
  trackBatches: z.boolean().default(false),
  trackSerials: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface CreateProductDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateProductDialog({ children, onSuccess }: CreateProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as Resolver<ProductFormData>,
    defaultValues: {
      unit: 'pcs',
      isActive: true,
      price: null,
      reorderLevel: null,
      trackBatches: false,
      trackSerials: false,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    try {
      setLoading(true);

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in.');
        }
        if (response.status === 403) {
          throw new Error('You do not have permission to create products.');
        }
        throw new Error(result.error || 'Failed to create product');
      }

      toast({
        title: 'Success',
        description: 'Product created successfully',
      });

      reset();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create product',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
          <DialogDescription>
            Add a new product to your inventory. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sku">
              SKU <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sku"
              placeholder="PROD-001"
              {...register('sku')}
              className={errors.sku ? 'border-destructive' : ''}
            />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Product name"
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Product description"
              {...register('description')}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="Electronics"
                {...register('category')}
                className={errors.category ? 'border-destructive' : ''}
              />
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="pcs"
                {...register('unit')}
                className={errors.unit ? 'border-destructive' : ''}
              />
              {errors.unit && (
                <p className="text-sm text-destructive">{errors.unit.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('price', { valueAsNumber: true })}
                className={errors.price ? 'border-destructive' : ''}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderLevel">Reorder level</Label>
              <Input
                id="reorderLevel"
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 10"
                {...register('reorderLevel', { setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v)) })}
                className={errors.reorderLevel ? 'border-destructive' : ''}
              />
              {errors.reorderLevel && (
                <p className="text-sm text-destructive">{errors.reorderLevel.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Alert when stock falls below this</p>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Tracking</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={watch('trackBatches')}
                  onCheckedChange={(checked) => setValue('trackBatches', !!checked)}
                />
                <span>Track Batches</span>
              </label>
              <p className="text-xs text-muted-foreground pl-6">Expiry / lot tracking per batch</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={watch('trackSerials')}
                  onCheckedChange={(checked) => setValue('trackSerials', !!checked)}
                />
                <span>Track Serials</span>
              </label>
              <p className="text-xs text-muted-foreground pl-6">Unique serial number per unit</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
