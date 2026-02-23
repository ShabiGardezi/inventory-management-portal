'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function LoginFormInner() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to get CSRF token'))))
      .then((data) => setCsrfToken(data.csrfToken))
      .catch(() => toast({ title: 'Error', description: 'Could not load sign-in form.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;
    if (error === 'Configuration') {
      toast({
        title: 'Configuration Error',
        description:
          process.env.NODE_ENV === 'production'
            ? 'Database connection failed. Ensure DATABASE_URL and DIRECT_URL are set in your hosting environment (e.g. Vercel Project Settings → Environment Variables) and the database is accessible.'
            : 'Database connection failed. Please check your DATABASE_URL in .env and ensure the database is running and accessible.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Login Failed',
      description: error === 'CredentialsSignin' ? 'Invalid email or password' : error,
      variant: 'destructive',
    });
  }, [searchParams, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to access the inventory management portal</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/callback/credentials" method="POST" className="space-y-4">
            <input type="hidden" name="csrfToken" value={csrfToken ?? ''} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !csrfToken}>
              {loading ? 'Loading...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Test accounts (password: password123):</p>
            <ul className="space-y-1 text-xs">
              <li>Admin: admin@example.com</li>
              <li>Manager: manager@example.com</li>
              <li>Staff: staff1@example.com, staff2@example.com</li>
              <li>Viewer: viewer@example.com</li>
              <li>Warehouse Lead: warehouse_lead@example.com</li>
              <li>Warehouse: warehouse@example.com</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginFormInner />
    </Suspense>
  );
}

