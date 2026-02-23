import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';
import { CtaSection } from '@/components/marketing/sections';

export const metadata: Metadata = buildMetadata({
  title: 'Pricing',
  description:
    'Transparent B2B SaaS pricing for inventory management: start with core stock control, then scale to barcoding, batch/serial tracking, approvals, and multi-warehouse workflows.',
  pathname: '/pricing',
});

export default function PricingPage() {
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: SITE.brandName,
    description: SITE.description,
    url: absoluteUrl('/pricing'),
    category: 'Inventory Management Software',
  };

  return (
    <>
      <JsonLd data={productJsonLd} />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing that scales with your operation</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground">
          Choose a plan that fits your workflow today—and expand as you add warehouses, approvals, barcoding, and
          traceability requirements.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              name: 'Starter',
              price: 'Contact sales',
              body: 'Core stock management for a single team with reporting and role-based access.',
              bullets: ['RBAC access', 'Stock movements + audit history', 'Basic reporting'],
            },
            {
              name: 'Growth',
              price: 'Contact sales',
              body: 'Multi-warehouse workflows with approvals and process controls.',
              bullets: ['Multi-warehouse transfers', 'Approval workflow', 'Operational reporting'],
              highlight: true,
            },
            {
              name: 'Enterprise',
              price: 'Contact sales',
              body: 'Advanced governance, traceability, and rollout support for complex operations.',
              bullets: ['Batch/serial traceability', 'Advanced controls', 'Implementation support'],
            },
          ].map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border bg-card p-6 ${tier.highlight ? 'ring-1 ring-primary' : ''}`}
            >
              <div className="text-sm font-semibold">{tier.name}</div>
              <div className="mt-2 text-2xl font-semibold">{tier.price}</div>
              <p className="mt-3 text-sm text-muted-foreground">{tier.body}</p>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {tier.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <Link
                href="/demo"
                className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Get a quote
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border bg-muted/20 p-6">
          <h2 className="text-xl font-semibold tracking-tight">Need region-specific guidance?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We support buying teams across Europe, the UK, the Gulf (UAE, Saudi Arabia, Qatar) and Scandinavia.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {[
              { href: '/eu/inventory-management-software', label: 'Europe' },
              { href: '/uk/inventory-management-software', label: 'UK' },
              { href: '/uae/inventory-management-software', label: 'UAE' },
              { href: '/saudi/inventory-management-software', label: 'Saudi Arabia' },
              { href: '/sweden/inventory-management-software', label: 'Sweden' },
              { href: '/norway/inventory-management-software', label: 'Norway' },
              { href: '/denmark/inventory-management-software', label: 'Denmark' },
            ].map((r) => (
              <Link key={r.href} href={r.href} className="rounded-md border bg-background px-3 py-1 hover:bg-muted">
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaSection
        heading="Get a tailored pricing proposal"
        body="Book a demo and we’ll scope your warehouses, workflows, and traceability requirements—then map a rollout plan for your team."
        primaryCtaHref="/demo"
        primaryCtaLabel="Book a demo"
        secondaryCtaHref="/inventory-management-software"
        secondaryCtaLabel="Explore features"
      />
    </>
  );
}

