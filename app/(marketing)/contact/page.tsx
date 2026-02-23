import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { ContactForm } from './contact-form';
import { Suspense } from 'react';

export const metadata: Metadata = buildMetadata({
  title: 'Contact Us',
  description:
    'Contact our team about inventory management software for B2B operations. Ask about multi-warehouse workflows, approvals, barcode scanning, and traceability.',
  pathname: '/contact',
});

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">Contact us</h1>
      <p className="mt-4 max-w-3xl text-base text-muted-foreground">
        Tell us what you’re looking to solve. We’ll respond within 1 business day. See{' '}
        <Link className="underline" href="/privacy">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Common topics</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Multi-warehouse inventory and transfers</li>
              <li>Approval workflows and audit trails</li>
              <li>Barcode inventory and scanning workflows</li>
              <li>Batch/serial traceability requirements</li>
              <li>Implementation approach and rollout planning</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
            If you want a guided walkthrough, use <Link className="underline" href="/demo">Book a Demo</Link>.
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold tracking-tight">Send a message</h2>
          <div className="mt-6">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
              <ContactForm />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

