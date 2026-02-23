export type LeadCountryOption = {
  value: string;
  label: string;
  group: 'EU' | 'UK' | 'GCC' | 'SCANDINAVIA' | 'OTHER';
};

export const LEAD_COUNTRY_OPTIONS: ReadonlyArray<LeadCountryOption> = [
  { value: 'EU', label: 'European Union (EU)', group: 'EU' },
  { value: 'UK', label: 'United Kingdom', group: 'UK' },
  { value: 'UAE', label: 'United Arab Emirates (UAE)', group: 'GCC' },
  { value: 'SAUDI', label: 'Saudi Arabia', group: 'GCC' },
  { value: 'QATAR', label: 'Qatar', group: 'GCC' },
  { value: 'SWEDEN', label: 'Sweden', group: 'SCANDINAVIA' },
  { value: 'NORWAY', label: 'Norway', group: 'SCANDINAVIA' },
  { value: 'DENMARK', label: 'Denmark', group: 'SCANDINAVIA' },
  { value: 'OTHER', label: 'Other', group: 'OTHER' },
] as const;

export type LeadCountryValue = (typeof LEAD_COUNTRY_OPTIONS)[number]['value'];

export function isGulfCountry(value: string): boolean {
  return value === 'UAE' || value === 'SAUDI' || value === 'QATAR';
}

