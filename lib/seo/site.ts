export const SITE = {
  brandName: 'Inventory Management Portal',
  legalName: 'Inventory Management Portal',
  description:
    'B2B inventory management SaaS with multi-warehouse control, barcode scanning, batch/serial tracking, approvals, and reporting for growing operations.',
  // Set in production (e.g. https://yourdomain.com)
  // Used for canonical URLs, OpenGraph/Twitter absolute URLs, sitemap/robots.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ogImagePath: '/opengraph-image',
  twitterImagePath: '/twitter-image',
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? undefined,
};

export function absoluteUrl(pathname: string): string {
  const base = SITE.siteUrl.replace(/\/+$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

