import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = buildMetadata({
  title: 'Book a Demo',
  description:
    'Book a tailored demo of our inventory management SaaS. See approvals, multi-warehouse workflows, barcode scanning, batch/serial tracking, and reporting for B2B operations.',
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
          We’ll tailor the walkthrough to your workflows (receiving, transfers, approvals, batch/serial, barcoding) and
          your region (Europe, UK, UAE, Saudi Arabia, Qatar, Sweden, Norway, Denmark).
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">What you’ll see</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Multi-warehouse stock visibility and transfers</li>
              <li>Inventory approval workflow and audit trail</li>
              <li>Barcode scanning workflows</li>
              <li>Batch and serial number tracking</li>
              <li>Reporting for investigation and operational KPIs</li>
            </ul>
            <div className="mt-6 rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">
              If you’d rather start with details first, view <Link className="underline" href="/pricing">pricing</Link>{" "}
              or explore{" "}
              <Link className="underline" href="/inventory-management-software">
                inventory management features
              </Link>
              .
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold tracking-tight">Request a demo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hook up your preferred booking flow here (Calendly/HubSpot). For now, this section is a placeholder to
              keep SEO routes production-ready.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-md border bg-background px-4 py-3 text-muted-foreground">Name</div>
              <div className="rounded-md border bg-background px-4 py-3 text-muted-foreground">Work email</div>
              <div className="rounded-md border bg-background px-4 py-3 text-muted-foreground">Company</div>
              <div className="rounded-md border bg-background px-4 py-3 text-muted-foreground">Region</div>
              <div className="rounded-md border bg-background px-4 py-3 text-muted-foreground">
                Notes (warehouses, SKUs, traceability needs)
              </div>
              <div className="rounded-md bg-primary px-4 py-3 text-center font-medium text-primary-foreground">
                Submit request
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: When ready, we can wire this to your CRM and ensure scripts don’t block LCP.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

