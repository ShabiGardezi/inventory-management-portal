import type { MetadataRoute } from 'next';
import { SITE, absoluteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/dashboard'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE.siteUrl,
  };
}

