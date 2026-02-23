import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo/site';
import { FEATURE_SLUGS } from '@/lib/seo/routes';
import { REGION_KEYS } from '@/lib/seo/regions';
import { getAllPosts } from '@/lib/blog/posts';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/pricing'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/demo'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/blog'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
  ];

  const featureUrls: MetadataRoute.Sitemap = FEATURE_SLUGS.map((slug) => ({
    url: absoluteUrl(`/${slug}`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: slug === 'inventory-management-software' ? 0.9 : 0.75,
  }));

  const regionUrls: MetadataRoute.Sitemap = REGION_KEYS.map((region) => ({
    url: absoluteUrl(`/${region}/inventory-management-software`),
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const blogPostUrls: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const categoryUrls: MetadataRoute.Sitemap = [
    absoluteUrl('/blog/category/inventory-operations'),
    absoluteUrl('/blog/category/warehouse-management'),
    absoluteUrl('/blog/category/traceability'),
    absoluteUrl('/blog/category/saas-buying'),
  ].map((url) => ({ url, lastModified: now, changeFrequency: 'monthly', priority: 0.4 }));

  return [...staticUrls, ...featureUrls, ...regionUrls, ...blogPostUrls, ...categoryUrls];
}

