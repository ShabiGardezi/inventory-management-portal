'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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

const schema = z.object({
  name: z.string().max(255).optional().nullable(),
  email: z.string().email('Invalid email').optional(),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { id: string; name: string }[];
}

interface EditUserDialogProps {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  canDisable: boolean;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
  canDisable,
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name ?? '', email: user.email, isActive: user.isActive },
  });

  useEffect(() => {
    if (open && user) {
      setValue('name', user.name ?? '');
      setValue('email', user.email);
      setValue('isActive', user.isActive);
    }
  }, [open, user, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const body: { name?: string | null; isActive?: boolean } = {};
      if (data.name !== undefined) body.name = data.name?.trim() ?? null;
      if (canDisable && data.isActive !== undefined) body.isActive = data.isActive;

      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 403) throw new Error(result.error ?? 'Permission denied');
        throw new Error(result.error ?? 'Failed to update user');
      }

      toast({ title: 'Success', description: 'User updated successfully.' });
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user profile. Status can only be changed if you have disable permission.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input
              id="edit-user-name"
              placeholder="Full name"
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              placeholder="user@example.com"
              {...register('email')}
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
          {canDisable && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-user-active"
                {...register('isActive')}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="edit-user-active">Active (user can sign in)</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
