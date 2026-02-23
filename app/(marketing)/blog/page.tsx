import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { BLOG_CATEGORIES, getAllPosts } from '@/lib/blog/posts';

export const metadata: Metadata = buildMetadata({
  title: 'Blog',
  description:
    'Practical guides for B2B inventory operations: inventory management software, warehouse workflows, traceability, approvals, and buying checklists.',
  pathname: '/blog',
});

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">Blog</h1>
      <p className="mt-4 max-w-3xl text-base text-muted-foreground">
        Guides for B2B inventory leaders: choosing software, tightening controls, and improving multi-warehouse
        execution.
      </p>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-xl border bg-card p-6 hover:bg-muted/30"
            >
              <div className="text-xs text-muted-foreground">
                {new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}{' '}
                · {post.category.replace('-', ' ')}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{post.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{post.description}</p>
              <div className="mt-4 text-sm font-medium">Read article →</div>
            </Link>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="text-sm font-semibold">Categories</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {BLOG_CATEGORIES.map((c) => (
                <li key={c.key}>
                  <Link className="underline hover:opacity-80" href={`/blog/category/${c.key}`}>
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="text-sm font-semibold">Popular pages</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="underline hover:opacity-80" href="/inventory-management-software">
                  Inventory management software
                </Link>
              </li>
              <li>
                <Link className="underline hover:opacity-80" href="/warehouse-management-system">
                  Warehouse management system
                </Link>
              </li>
              <li>
                <Link className="underline hover:opacity-80" href="/demo">
                  Book a demo
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

