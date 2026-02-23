import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { FEATURES } from '@/lib/seo/features';
import { FEATURE_SLUGS, type FeatureSlug } from '@/lib/seo/routes';
import { ComparisonTable, CtaSection, FaqSection, TrustIndicators } from '@/components/marketing/sections';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!(slug in FEATURES)) return {};
  const feature = FEATURES[slug as FeatureSlug];

  return buildMetadata({
    title: feature.seoTitle,
    description: feature.seoDescription,
    pathname: `/${feature.slug}`,
    keywords: [feature.primaryKeyword, ...feature.secondaryKeywords],
    alternates:
      feature.slug === 'inventory-management-software'
        ? {
            canonical: '/inventory-management-software',
            languages: {
              'x-default': '/inventory-management-software',
              en: '/eu/inventory-management-software',
              'en-GB': '/uk/inventory-management-software',
              'en-AE': '/uae/inventory-management-software',
              'en-SA': '/saudi/inventory-management-software',
              'en-QA': '/qatar/inventory-management-software',
              'en-SE': '/sweden/inventory-management-software',
              'en-NO': '/norway/inventory-management-software',
              'en-DK': '/denmark/inventory-management-software',
            },
          }
        : undefined,
  });
}

export default async function FeaturePage({ params }: PageProps) {
  const { slug } = await params;
  if (!(slug in FEATURES)) notFound();
  const feature = FEATURES[slug as FeatureSlug];

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${SITE.brandName} — ${feature.navLabel}`,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description: feature.seoDescription,
    url: absoluteUrl(`/${feature.slug}`),
  };

  const faqJsonLd =
    feature.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: feature.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : undefined;

  return (
    <>
      <JsonLd data={faqJsonLd ? [softwareJsonLd, faqJsonLd] : [softwareJsonLd]} />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">{feature.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">{feature.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={feature.cta.primaryCtaHref}
              className="rounded-md bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {feature.cta.primaryCtaLabel}
            </Link>
            <Link
              href={feature.cta.secondaryCtaHref}
              className="rounded-md border px-5 py-3 text-center text-sm font-medium hover:bg-muted"
            >
              {feature.cta.secondaryCtaLabel}
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Popular in:{" "}
            <Link className="underline hover:opacity-80" href="/eu/inventory-management-software">
              Europe
            </Link>
            ,{" "}
            <Link className="underline hover:opacity-80" href="/uk/inventory-management-software">
              UK
            </Link>
            ,{" "}
            <Link className="underline hover:opacity-80" href="/uae/inventory-management-software">
              UAE
            </Link>
            ,{" "}
            <Link className="underline hover:opacity-80" href="/sweden/inventory-management-software">
              Scandinavia
            </Link>
            .
          </p>
        </div>
      </section>

      <TrustIndicators />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1fr_280px]">
          <article className="space-y-10">
            {feature.sections.map((section) => (
              <section key={section.heading} className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {section.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
                {section.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold">Related features</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {feature.related.map((rel) => (
                  <li key={rel}>
                    <Link className="underline hover:opacity-80" href={`/${rel}`}>
                      {FEATURES[rel].navLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold">Next step</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Get a region-tailored walkthrough and an implementation plan for your workflows.
              </p>
              <Link
                href="/demo"
                className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Book a demo
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <ComparisonTable
        heading={feature.comparison.heading}
        paragraphs={feature.comparison.paragraphs}
        rows={feature.comparison.table}
      />

      <FaqSection items={feature.faq} />

      <CtaSection
        heading={feature.cta.heading}
        body={feature.cta.body}
        primaryCtaHref={feature.cta.primaryCtaHref}
        primaryCtaLabel={feature.cta.primaryCtaLabel}
        secondaryCtaHref={feature.cta.secondaryCtaHref}
        secondaryCtaLabel={feature.cta.secondaryCtaLabel}
      />
    </>
  );
}

