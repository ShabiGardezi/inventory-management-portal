import type { Metadata } from 'next';
import { SITE, absoluteUrl } from '@/lib/seo/site';

type BuildMetadataParams = {
  title: string;
  description: string;
  pathname: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  keywords?: string[];
  alternates?: {
    canonical?: string;
    languages?: Record<string, string>;
  };
};

function clampTitle(title: string): string {
  // Hard cap to reduce SERP truncation risk; keeps build stable.
  return title.length > 60 ? title.slice(0, 57).trimEnd() + '…' : title;
}

function clampDescription(description: string): string {
  return description.length > 160 ? description.slice(0, 157).trimEnd() + '…' : description;
}

export function buildMetadata({
  title,
  description,
  pathname,
  ogType = 'website',
  noindex,
  keywords,
  alternates,
}: BuildMetadataParams): Metadata {
  const safeTitle = clampTitle(title);
  const safeDescription = clampDescription(description);
  const canonical = alternates?.canonical ?? pathname;

  return {
    title: safeTitle,
    description: safeDescription,
    keywords,
    metadataBase: new URL(SITE.siteUrl),
    alternates: {
      canonical,
      languages: alternates?.languages,
    },
    openGraph: {
      type: ogType,
      title: safeTitle,
      description: safeDescription,
      siteName: SITE.brandName,
      url: absoluteUrl(pathname),
      images: [
        {
          url: absoluteUrl(SITE.ogImagePath),
          width: 1200,
          height: 630,
          alt: `${SITE.brandName} — ${safeTitle}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDescription,
      images: [absoluteUrl(SITE.twitterImagePath)],
      site: SITE.twitterHandle,
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
            'max-snippet': 0,
          },
        }
      : {
          index: true,
          follow: true,
        },
  };
}

