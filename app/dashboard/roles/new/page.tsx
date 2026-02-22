'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewRolePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const permissions: string[] = (session?.user as { permissions?: string[] })?.permissions ?? [];
  const canManage = permissions.includes('roles.manage');

  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Create Role</h1>
          <p className="text-muted-foreground">You do not have permission to create roles.</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">roles.manage is required.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/roles">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Roles
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          description: data.description?.trim() || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Failed to create role');
      toast({ title: 'Role created', description: `"${data.name}" has been created. You can now assign permissions.` });
      router.push(`/dashboard/roles/${result.id}`);
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to create role',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/roles">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Role</h1>
          <p className="text-muted-foreground">Add a new custom role. You can set permissions on the next page.</p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Role details</CardTitle>
          <CardDescription>Name must be unique. Description is optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role name</Label>
              <Input
                id="name"
                placeholder="e.g. Warehouse Lead"
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Short description"
                {...register('description')}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create role'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/roles">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
