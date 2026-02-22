'use client';

import { useState } from 'react';
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
  DialogTrigger,
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

const schema = z.object({
  name: z.string().max(255).optional().nullable(),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface AddUserDialogProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  roles: RoleOption[];
  canAssignRole: boolean;
}

export function AddUserDialog({
  children,
  open,
  onOpenChange,
  onSuccess,
  roles,
  canAssignRole,
}: AddUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const body: { email: string; name?: string; password: string; roleIds?: string[] } = {
        email: data.email,
        password: data.password,
      };
      if (data.name?.trim()) body.name = data.name.trim();
      if (canAssignRole && roleIds.length > 0) body.roleIds = roleIds;

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 403) throw new Error(result.error ?? 'Permission denied');
        if (res.status === 409) throw new Error(result.error ?? 'User already exists');
        throw new Error(result.error ?? 'Failed to create user');
      }

      toast({ title: 'Success', description: 'User created successfully.' });
      reset();
      setRoleIds([]);
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add / Invite User</DialogTitle>
          <DialogDescription>
            Create a new user with email and temporary password. They can sign in and change their password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-user-name">Name</Label>
            <Input
              id="add-user-name"
              placeholder="Full name"
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-email">Email <span className="text-destructive">*</span></Label>
            <Input
              id="add-user-email"
              type="email"
              placeholder="user@example.com"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-password">Temporary password <span className="text-destructive">*</span></Label>
            <Input
              id="add-user-password"
              type="password"
              placeholder="Min 8 characters"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          {canAssignRole && roles.length > 0 && (
            <div className="space-y-2">
              <Label>Role (optional)</Label>
              <Select
                value={roleIds[0] ?? '__none__'}
                onValueChange={(v) => setRoleIds(v && v !== '__none__' ? [v] : [])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
