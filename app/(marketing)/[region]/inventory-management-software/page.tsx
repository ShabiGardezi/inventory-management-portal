import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { getRegion, REGION_KEYS } from '@/lib/seo/regions';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';
import { CtaSection, FaqSection, TrustIndicators } from '@/components/marketing/sections';

type PageProps = {
  params: Promise<{ region: string }>;
};

export function generateStaticParams() {
  return REGION_KEYS.map((region) => ({ region }));
}

function buildHreflangAlternates() {
  return {
    'x-default': '/inventory-management-software',
    en: '/eu/inventory-management-software',
    'en-GB': '/uk/inventory-management-software',
    'en-AE': '/uae/inventory-management-software',
    'en-SA': '/saudi/inventory-management-software',
    'en-QA': '/qatar/inventory-management-software',
    'en-SE': '/sweden/inventory-management-software',
    'en-NO': '/norway/inventory-management-software',
    'en-DK': '/denmark/inventory-management-software',
  } as Record<string, string>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionKey } = await params;
  const region = getRegion(regionKey);
  if (!region) return {};

  const pathname = `${region.pathPrefix}/inventory-management-software`;

  return buildMetadata({
    title: `Inventory Management Software in ${region.geoName}`,
    description: `Inventory management software for B2B teams in ${region.geoName}: multi-warehouse control, approvals, barcode scanning, and batch/serial tracking.`,
    pathname,
    keywords: [
      'inventory management software',
      'stock management system',
      `inventory software ${region.geoName.toLowerCase()}`,
      `warehouse management ${region.geoName.toLowerCase()}`,
      'barcode inventory system',
      'inventory approval workflow',
    ],
    alternates: {
      canonical: pathname,
      languages: buildHreflangAlternates(),
    },
  });
}

export default async function RegionInventoryLandingPage({ params }: PageProps) {
  const { region: regionKey } = await params;
  const region = getRegion(regionKey);
  if (!region) notFound();

  const pathname = `${region.pathPrefix}/inventory-management-software`;

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${SITE.brandName} — Inventory Management (${region.label})`,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description: `Inventory management software for B2B teams in ${region.geoName}.`,
    url: absoluteUrl(pathname),
    areaServed: region.geoName,
  };

  const faq = [
    {
      question: `Is this inventory software a good fit for teams in ${region.geoName}?`,
      answer:
        'Yes. It’s designed for B2B teams that need controlled stock movements, approvals, audit trails, and multi-warehouse visibility—common requirements across growing operations.',
    },
    {
      question: 'Do you support multi-warehouse inventory?',
      answer:
        'Yes. Track stock by warehouse, manage transfers, and keep reporting consistent so teams can plan replenishment more confidently.',
    },
    {
      question: 'Does it support barcode scanning and traceability?',
      answer:
        'Yes. Barcode workflows reduce manual errors, and batch/serial tracking supports traceability where required.',
    },
    {
      question: 'Can we book a region-tailored demo?',
      answer:
        'Yes. We tailor demos to your workflows and your rollout constraints (warehouses, team roles, approvals, and traceability needs).',
    },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <JsonLd data={[softwareJsonLd, faqJsonLd]} />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">
            Inventory management software for {region.label} B2B teams
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Standardize stock movements with approvals and audit trails. Improve accuracy with barcode workflows, and
            add traceability with batch/serial tracking—across one or many warehouses in {region.geoName}.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="rounded-md bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border px-5 py-3 text-center text-sm font-medium hover:bg-muted"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <TrustIndicators />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Why B2B teams choose this in {region.geoName}</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              title: 'Fewer inventory mistakes',
              body: 'Approvals and RBAC reduce risky edits and improve accountability across teams and shifts.',
            },
            {
              title: 'Multi-warehouse clarity',
              body: 'Track stock by warehouse and use controlled transfers to keep reporting trustworthy.',
            },
            {
              title: 'Traceability-ready',
              body: 'Barcode workflows plus batch/serial tracking support quality-sensitive operations.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border bg-card p-6">
              <h3 className="font-medium">{card.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border bg-muted/20 p-6">
          <h2 className="text-xl font-semibold tracking-tight">Explore the global feature set</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If you’re comparing solutions across regions, start with the core product pages below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {[
              { href: '/inventory-management-software', label: 'Inventory management' },
              { href: '/warehouse-management-system', label: 'Warehouse management' },
              { href: '/barcode-inventory-system', label: 'Barcode inventory' },
              { href: '/batch-serial-tracking-software', label: 'Batch & serial tracking' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md border bg-background px-3 py-1 hover:bg-muted">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <FaqSection items={faq} />

      <CtaSection
        heading={`Book a ${region.label}-tailored demo`}
        body="We’ll map your workflows (receiving, transfers, approvals, traceability) and outline a rollout plan for your team."
        primaryCtaHref="/demo"
        primaryCtaLabel="Book a demo"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="View pricing"
      />
    </>
  );
}

