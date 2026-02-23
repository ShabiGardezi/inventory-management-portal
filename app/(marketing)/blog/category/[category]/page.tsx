import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/seo/metadata';
import { BLOG_CATEGORIES, type BlogCategory, getPostsByCategory } from '@/lib/blog/posts';

type PageProps = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ category: c.key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const cat = BLOG_CATEGORIES.find((c) => c.key === category);
  if (!cat) return {};

  return buildMetadata({
    title: `Blog: ${cat.label}`,
    description: `Articles on ${cat.label.toLowerCase()} for B2B inventory and warehouse teams: controls, traceability, and buying guides.`,
    pathname: `/blog/category/${cat.key}`,
  });
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const cat = BLOG_CATEGORIES.find((c) => c.key === category);
  if (!cat) notFound();

  const posts = getPostsByCategory(category as BlogCategory);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-xs text-muted-foreground">
        <Link className="underline hover:opacity-80" href="/blog">
          Blog
        </Link>{' '}
        / {cat.label}
      </div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{cat.label}</h1>
      <p className="mt-4 max-w-3xl text-base text-muted-foreground">
        Practical articles for B2B teams improving inventory accuracy and warehouse execution.
      </p>

      <div className="mt-10 space-y-4">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="block rounded-xl border bg-card p-6 hover:bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}
            </div>
            <div className="mt-2 text-xl font-semibold tracking-tight">{post.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

