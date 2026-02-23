import Link from 'next/link';
import { MARKETING_ROUTES } from '@/lib/seo/routes';

const NAV = [
  { href: '/inventory-management-software', label: 'Features' },
  { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
  { href: MARKETING_ROUTES.blog, label: 'Blog' },
] as const;

export function MarketingHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href={MARKETING_ROUTES.home} className="font-semibold tracking-tight">
          Inventory Management
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-foreground/80 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Contact
          </Link>
          <Link
            href={MARKETING_ROUTES.demo}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Book a demo
          </Link>
          <Link href="/login" className="text-sm text-foreground/80 hover:text-foreground">
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

