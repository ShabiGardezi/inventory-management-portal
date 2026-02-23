import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE, absoluteUrl } from '@/lib/seo/site';
import { TrustIndicators, CtaSection } from '@/components/marketing/sections';
import { JsonLd } from '@/components/seo/json-ld';

export const metadata: Metadata = buildMetadata({
  title: 'B2B Inventory Management SaaS for Multi-Warehouse Teams',
  description:
    'Inventory management SaaS with approvals, barcode scanning, batch/serial tracking, and multi-warehouse visibility—built for B2B operations in Europe, UK, Gulf, and Scandinavia.',
  pathname: '/',
});

export default function MarketingHomePage() {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.legalName,
    url: absoluteUrl('/'),
    description: SITE.description,
  };

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.brandName,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description: SITE.description,
    url: absoluteUrl('/'),
  };

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: SITE.brandName,
    description: SITE.description,
    url: absoluteUrl('/'),
    category: 'Inventory Management Software',
  };

  return (
    <>
      <JsonLd data={[orgJsonLd, softwareJsonLd, productJsonLd]} />

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Inventory management software built for B2B operational control
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Standardize receiving, transfers, adjustments, and approvals with audit trails, barcode workflows, and
              traceability. Designed for multi-warehouse teams across Europe, the UK, the Gulf, and Scandinavia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="rounded-md bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Book a demo
              </Link>
              <Link
                href="/inventory-management-software"
                className="rounded-md border px-5 py-3 text-center text-sm font-medium hover:bg-muted"
              >
                Explore features
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Looking for the app? <Link className="underline hover:opacity-80" href="/login">Sign in</Link>.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-7">
            <div className="text-sm font-semibold">What teams use this for</div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Multi-warehouse stock control</span> with reliable
                transfers and reconciliation
              </li>
              <li>
                <span className="font-medium text-foreground">Batch and serial tracking</span> for quality and
                traceability requirements
              </li>
              <li>
                <span className="font-medium text-foreground">Approval workflows</span> that reduce costly inventory
                mistakes
              </li>
              <li>
                <span className="font-medium text-foreground">Barcode inventory</span> to speed up receiving and reduce
                errors
              </li>
            </ul>
          </div>
        </div>
      </section>

      <TrustIndicators />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Core capabilities</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Inventory approvals + audit trails',
              body: 'Control high-impact adjustments with a clear approval queue and traceable history.',
              href: '/inventory-approval-workflow',
            },
            {
              title: 'Warehouse management system',
              body: 'Track stock by warehouse and keep transfers consistent across locations.',
              href: '/warehouse-management-system',
            },
            {
              title: 'Batch and serial tracking',
              body: 'Maintain lot/unit traceability for regulated and high-value inventory.',
              href: '/batch-serial-tracking-software',
            },
            {
              title: 'Barcode inventory system',
              body: 'Reduce manual entry with scanning-ready workflows that keep data clean.',
              href: '/barcode-inventory-system',
            },
          ].map((card) => (
            <Link key={card.href} href={card.href} className="rounded-xl border bg-card p-6 hover:bg-muted/30">
              <div className="font-medium">{card.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
              <div className="mt-4 text-sm font-medium">Learn more →</div>
            </Link>
          ))}
        </div>
      </section>

      <CtaSection
        heading="Book a demo for your region"
        body="We’ll tailor the walkthrough to your workflows and region-specific requirements (Europe, UK, UAE, Saudi Arabia, Qatar, Sweden, Norway, Denmark)."
        primaryCtaHref="/demo"
        primaryCtaLabel="Book a demo"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="View pricing"
      />
    </>
  );
}

