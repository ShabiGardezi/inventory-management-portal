export type BlogCategory = 'inventory-operations' | 'warehouse-management' | 'traceability' | 'saas-buying';

export type BlogAuthor = {
  name: string;
  title: string;
};

export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  keywords: string[];
  publishedAt: string; // ISO date
  updatedAt?: string; // ISO date
  author: BlogAuthor;
  sections: BlogSection[];
};

const DEFAULT_AUTHOR: BlogAuthor = {
  name: 'Inventory Ops Team',
  title: 'B2B Inventory Systems',
};

export const BLOG_CATEGORIES: Array<{ key: BlogCategory; label: string }> = [
  { key: 'inventory-operations', label: 'Inventory Operations' },
  { key: 'warehouse-management', label: 'Warehouse Management' },
  { key: 'traceability', label: 'Traceability' },
  { key: 'saas-buying', label: 'SaaS Buying Guides' },
];

const POSTS: BlogPost[] = [
  {
    slug: 'inventory-management-software-buyers-guide',
    title: 'Inventory management software buyer’s guide (B2B)',
    description:
      'A practical checklist for selecting inventory management software: controls, multi-warehouse, approvals, traceability, and reporting for B2B operations.',
    category: 'saas-buying',
    keywords: [
      'inventory management software',
      'stock management system',
      'warehouse management system',
      'inventory approval workflow',
      'barcode inventory system',
    ],
    publishedAt: '2026-02-23',
    author: DEFAULT_AUTHOR,
    sections: [
      {
        heading: 'What “good” looks like for B2B inventory teams',
        paragraphs: [
          'B2B inventory operations often have a different failure mode than DTC: fewer orders, higher impact. When inventory numbers are wrong, consequences show up as missed delivery dates, expensive expedites, and customer churn.',
          'A strong inventory system should improve operational control first (permissions, approvals, audit trails), then improve speed (barcode workflows), then expand into traceability and forecasting as your data quality improves.',
        ],
      },
      {
        heading: 'Must-have capabilities',
        paragraphs: [
          'Start with what prevents the most expensive mistakes. In most B2B orgs, that’s not a fancy dashboard—it’s making sure adjustments, transfers, and receiving follow consistent rules.',
          'Use this checklist to filter vendors quickly: multi-warehouse visibility, controlled transfers, approvals for high-impact movements, and event-level audit history.',
        ],
      },
      {
        heading: 'Questions to ask in demos',
        paragraphs: [
          'Ask to see a complete workflow, not isolated screens. For example: receive stock, transfer between warehouses, approve an adjustment, and then run a report that explains exactly what changed.',
          'If traceability matters, ask how batch and serial data is captured, whether it’s required at key steps, and how quickly you can answer “what shipped to customer X?”',
        ],
      },
      {
        heading: 'How to plan rollout',
        paragraphs: [
          'Most implementations fail due to process mismatch, not software gaps. Define who can do what (roles), which actions require approvals, and what counts as “done” for receiving and transfers.',
          'Roll out in phases: core stock control first, barcoding next, then traceability and forecasting once your movement history is consistent.',
        ],
      },
    ],
  },
  {
    slug: 'batch-vs-serial-tracking',
    title: 'Batch vs serial tracking: which one do you need?',
    description:
      'Learn the difference between batch tracking and serial number tracking, and when B2B inventory teams should implement each approach.',
    category: 'traceability',
    keywords: ['batch tracking software', 'serial number tracking software', 'traceability', 'fifo inventory software'],
    publishedAt: '2026-02-23',
    author: DEFAULT_AUTHOR,
    sections: [
      {
        heading: 'Batch tracking explained',
        paragraphs: [
          'Batch tracking (lot tracking) groups inventory into lots—typically aligned to a manufacturing run, supplier batch, or expiry group. It’s common for perishables, regulated goods, and any scenario where recalls are batch-based.',
          'The operational question batch tracking answers is: which lot did this come from, and where did that lot go?',
        ],
      },
      {
        heading: 'Serial number tracking explained',
        paragraphs: [
          'Serial tracking assigns a unique identifier to each unit. It’s often needed for devices, equipment, high-value assets, and warranty/service workflows.',
          'The key question serial tracking answers is: what is the complete history of this specific unit?',
        ],
      },
      {
        heading: 'How to choose',
        paragraphs: [
          'If compliance or recalls are part of your world, you usually know which model you need. If you’re unsure, start with the highest risk SKUs and implement traceability there first.',
          'For many B2B teams, batch tracking is the first step. Serial tracking is typically justified when unit-level accountability has clear business value (warranty, safety, theft prevention, service).',
        ],
      },
      {
        heading: 'The hidden requirement: process consistency',
        paragraphs: [
          'Traceability fails when the process is optional. Your system needs consistent capture points in receiving, transfers, and shipping confirmations—otherwise your traceability report becomes guesswork.',
          'Approvals and audit trails support traceability by preventing “silent fixes” that break the chain of custody.',
        ],
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function estimateReadTimeMinutes(post: BlogPost): number {
  const words =
    post.title.split(/\s+/).length +
    post.description.split(/\s+/).length +
    post.sections
      .flatMap((s) => [s.heading, ...s.paragraphs])
      .join(' ')
      .split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.round(words / 200));
}

export function buildToc(post: BlogPost): Array<{ id: string; label: string }> {
  return post.sections.map((s) => ({
    id: slugifyHeading(s.heading),
    label: s.heading,
  }));
}

export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

