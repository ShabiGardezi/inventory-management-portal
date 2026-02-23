import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="font-semibold">Inventory Management</div>
          <p className="mt-2 text-sm text-muted-foreground">
            B2B inventory management SaaS for multi-warehouse teams that need accuracy, controls, and traceability.
          </p>
        </div>

        <div className="text-sm">
          <div className="font-medium">Product</div>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link href="/inventory-management-software" className="hover:text-foreground">
                Inventory management
              </Link>
            </li>
            <li>
              <Link href="/warehouse-management-system" className="hover:text-foreground">
                Warehouse management
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <div className="font-medium">Company</div>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link href="/demo" className="hover:text-foreground">
                Book a demo
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-foreground">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Inventory Management Portal</span>
          <span>Built for B2B teams in Europe, UK, Gulf, and Scandinavia</span>
        </div>
      </div>
    </footer>
  );
}

