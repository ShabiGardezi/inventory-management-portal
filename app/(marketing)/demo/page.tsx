import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';
import { DemoForm } from './demo-form';
import { Suspense } from 'react';

export const metadata: Metadata = buildMetadata({
  title: 'Inventory Management Software Demo',
  description:
    'Request a demo of our inventory management software. See multi-warehouse workflows, approvals, barcode scanning, batch/serial tracking, and reporting built for B2B teams.',
  pathname: '/demo',
});

export default function DemoPage() {
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.brandName,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description: SITE.description,
    url: absoluteUrl('/demo'),
  };

  return (
    <>
      <JsonLd data={softwareJsonLd} />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Book a demo</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Request a tailored walkthrough for your workflows and region. We’ll follow up within 24 hours.
        </p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <h2 className="text-xl font-semibold tracking-tight">What you’ll get</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Multi-warehouse stock visibility and transfers</li>
                <li>Inventory approval workflow and audit trail</li>
                <li>Barcode scanning workflows</li>
                <li>Batch and serial number tracking</li>
                <li>Reporting for investigation and operational KPIs</li>
              </ul>
            </div>

            <div className="rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground">
              Prefer to browse first? See <Link className="underline" href="/pricing">pricing</Link> or explore{' '}
              <Link className="underline" href="/inventory-management-software">features</Link>.
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Request a demo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We use your information to respond to your request. See{' '}
              <Link className="underline" href="/privacy">Privacy Policy</Link>.
            </p>
            <div className="mt-6">
              <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
                <DemoForm />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

