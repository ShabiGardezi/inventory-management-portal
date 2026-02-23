import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { LoginForm } from './login-form';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description: 'Sign in to access your dashboard. This page is not indexed by search engines.',
  pathname: '/login',
  noindex: true,
});

export default function LoginPage() {
  return <LoginForm />;
}
