export type RegionKey = 'eu' | 'uk' | 'uae' | 'saudi' | 'qatar' | 'sweden' | 'norway' | 'denmark';

export type RegionConfig = {
  key: RegionKey;
  label: string;
  // hreflang language-region codes
  hreflang: string;
  // URL segment used in routes (matches key)
  pathPrefix: `/${RegionKey}`;
  // Used in titles/keywords to localize intent
  geoName: string;
};

export const REGIONS: ReadonlyArray<RegionConfig> = [
  {
    key: 'eu',
    label: 'Europe',
    hreflang: 'en',
    pathPrefix: '/eu',
    geoName: 'Europe',
  },
  {
    key: 'uk',
    label: 'United Kingdom',
    hreflang: 'en-GB',
    pathPrefix: '/uk',
    geoName: 'United Kingdom',
  },
  {
    key: 'uae',
    label: 'United Arab Emirates',
    hreflang: 'en-AE',
    pathPrefix: '/uae',
    geoName: 'UAE',
  },
  {
    key: 'saudi',
    label: 'Saudi Arabia',
    hreflang: 'en-SA',
    pathPrefix: '/saudi',
    geoName: 'Saudi Arabia',
  },
  {
    key: 'qatar',
    label: 'Qatar',
    hreflang: 'en-QA',
    pathPrefix: '/qatar',
    geoName: 'Qatar',
  },
  {
    key: 'sweden',
    label: 'Sweden',
    hreflang: 'en-SE',
    pathPrefix: '/sweden',
    geoName: 'Sweden',
  },
  {
    key: 'norway',
    label: 'Norway',
    hreflang: 'en-NO',
    pathPrefix: '/norway',
    geoName: 'Norway',
  },
  {
    key: 'denmark',
    label: 'Denmark',
    hreflang: 'en-DK',
    pathPrefix: '/denmark',
    geoName: 'Denmark',
  },
] as const;

export const REGION_KEYS: ReadonlyArray<RegionKey> = REGIONS.map((r) => r.key);

export function getRegion(key: string): RegionConfig | undefined {
  return REGIONS.find((r) => r.key === key);
}

