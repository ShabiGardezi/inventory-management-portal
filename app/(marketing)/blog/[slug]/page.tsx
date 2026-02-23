import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildToc, estimateReadTimeMinutes, getAllPosts, getPostBySlug, slugifyHeading } from '@/lib/blog/posts';
import { JsonLd } from '@/components/seo/json-ld';
import { SITE, absoluteUrl } from '@/lib/seo/site';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return buildMetadata({
    title: post.title,
    description: post.description,
    pathname: `/blog/${post.slug}`,
    ogType: 'article',
    keywords: post.keywords,
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const toc = buildToc(post);
  const readTime = estimateReadTimeMinutes(post);

  const published = new Date(post.publishedAt).toISOString();
  const modified = new Date(post.updatedAt ?? post.publishedAt).toISOString();

  const authorJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: post.author.name,
    jobTitle: post.author.title,
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: { '@type': 'Person', name: post.author.name },
    datePublished: published,
    dateModified: modified,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    publisher: { '@type': 'Organization', name: SITE.legalName, url: absoluteUrl('/') },
  };

  return (
    <>
      <JsonLd data={[authorJsonLd, articleJsonLd]} />

      <article className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-3xl">
          <div className="text-xs text-muted-foreground">
            {new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}{' '}
            · {readTime} min read ·{' '}
            <Link className="underline hover:opacity-80" href={`/blog/category/${post.category}`}>
              {post.category.replace('-', ' ')}
            </Link>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{post.title}</h1>
          <p className="mt-4 text-base text-muted-foreground">{post.description}</p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[1fr_280px]">
          <div className="space-y-10">
            {post.sections.map((section) => {
              const id = slugifyHeading(section.heading);
              return (
                <section key={section.heading} id={id} className="scroll-mt-24">
                  <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
                  <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                    {section.paragraphs.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                </section>
              );
            })}

            <section className="rounded-xl border bg-muted/20 p-6">
              <h2 className="text-xl font-semibold tracking-tight">Next steps</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                If you’re evaluating solutions, start with our core pages and book a region-tailored demo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {[
                  { href: '/inventory-management-software', label: 'Inventory management software' },
                  { href: '/warehouse-management-system', label: 'Warehouse management system' },
                  { href: '/inventory-approval-workflow', label: 'Inventory approval workflow' },
                  { href: '/demo', label: 'Book a demo' },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-md border bg-background px-3 py-1 hover:bg-muted">
                    {l.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold">Table of contents</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a className="underline hover:opacity-80" href={`#${item.id}`}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="text-sm font-semibold">About the author</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {post.author.name} · {post.author.title}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                We share practical guidance for B2B teams building repeatable inventory workflows across warehouses.
              </p>
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}

