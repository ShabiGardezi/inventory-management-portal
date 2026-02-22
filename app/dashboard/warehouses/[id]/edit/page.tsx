'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
}

export default function EditWarehousePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toast } = useToast();
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/warehouses/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: Warehouse) => {
        setWarehouse(data);
        setName(data.name);
        setCode(data.code ?? '');
        setAddress(data.address ?? '');
        setCity(data.city ?? '');
        setCountry(data.country ?? '');
      })
      .catch(() => setWarehouse(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: 'Validation error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/warehouses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Error', description: data.error ?? 'Failed to update warehouse', variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Warehouse updated.' });
      router.push(`/dashboard/warehouses/${id}`);
    } catch {
      toast({ title: 'Error', description: 'Failed to update warehouse', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !warehouse) {
    return (
      <div className="max-w-xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/warehouses/${id}`}>← Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Edit Warehouse</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Warehouse details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Warehouse"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code (optional)</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WH-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City (optional)</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country (optional)</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/dashboard/warehouses/${id}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
