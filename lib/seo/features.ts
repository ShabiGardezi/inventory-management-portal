import type { FeatureSlug } from '@/lib/seo/routes';
import { MARKETING_ROUTES } from '@/lib/seo/routes';

export type FaqItem = { question: string; answer: string };

export type FeaturePageContent = {
  slug: FeatureSlug;
  navLabel: string;
  title: string; // page title (H1)
  seoTitle: string; // <title>
  seoDescription: string; // meta description
  primaryKeyword: string;
  secondaryKeywords: string[];
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
  comparison: {
    heading: string;
    paragraphs: string[];
    table: Array<{ label: string; generic: string; ours: string }>;
  };
  faq: FaqItem[];
  cta: {
    heading: string;
    body: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
  related: FeatureSlug[];
};

const CTA = {
  heading: 'See it in action',
  body: 'Book a tailored demo to map your workflows (receiving, transfers, approvals, picking, valuation) and get a rollout plan for your team.',
  primaryCtaLabel: 'Book a demo',
  primaryCtaHref: MARKETING_ROUTES.demo,
  secondaryCtaLabel: 'View pricing',
  secondaryCtaHref: MARKETING_ROUTES.pricing,
} as const;

const COMMON_FAQ: FaqItem[] = [
  {
    question: 'Is this built for B2B operations?',
    answer:
      'Yes. It’s designed for role-based access, approvals, audit trails, multi-warehouse inventory, and operational reporting—typical requirements for B2B teams.',
  },
  {
    question: 'Can we start small and scale?',
    answer:
      'Yes. You can start with core stock control and expand into barcoding, batch/serial tracking, approvals, and forecasting as processes mature.',
  },
  {
    question: 'Do you support multiple warehouses and locations?',
    answer:
      'Yes. Track stock by warehouse and location, manage transfers, and keep consistent valuation and auditability across sites.',
  },
  {
    question: 'How do you prevent inventory mistakes?',
    answer:
      'Using controlled workflows (approvals), barcode scanning, batch/serial traceability, and audit logs, teams can reduce manual entry errors and improve accountability.',
  },
];

function standardLongformSections(context: {
  capability: string;
  decisionDrivers: string[];
  operationalExamples: string[];
}): FeaturePageContent['sections'] {
  return [
    {
      heading: 'Implementation that fits real warehouse workflows',
      paragraphs: [
        `Most B2B teams don’t fail because they picked the “wrong feature list”—they fail because the process doesn’t match day‑to‑day reality. When you implement ${context.capability}, start by mapping the exact steps operators take in receiving, transfers, and exception handling.`,
        'The goal is to remove ambiguity. Define what “done” means, which fields are required at each step, and which actions need review. Once the workflow is consistent, training becomes easier and reporting becomes meaningfully comparable across teams and locations.',
      ],
      bullets: [
        'Define roles and permissions before rollout',
        'Make required data capture explicit (not optional)',
        'Roll out in phases to keep adoption high',
      ],
    },
    {
      heading: 'Security, governance, and auditability for B2B buyers',
      paragraphs: [
        'Operational software becomes mission critical quickly. B2B buying teams usually need clear governance: who can change stock, what approvals exist, and how exceptions are investigated. Auditability reduces risk and makes compliance discussions easier.',
        `If you’re evaluating platforms, prioritize ${context.decisionDrivers.join(', ')}—because these are the controls that prevent the most expensive mistakes when teams scale.`,
      ],
    },
    {
      heading: 'What to measure after go-live',
      paragraphs: [
        'SEO buyers often ask for “ROI”, but inventory ROI is operational: fewer mistakes, fewer expedites, fewer stockouts, and faster investigation. Pick a baseline before rollout and track improvements monthly.',
        `Common KPIs after implementing ${context.capability} include inventory accuracy, adjustment frequency, approval turnaround time, transfer discrepancy rates, and fulfillment exception rates.`,
      ],
    },
    {
      heading: 'Common pitfalls (and how to avoid them)',
      paragraphs: [
        'Most inventory software projects stumble in predictable ways: optional data capture, inconsistent transfers, and ungoverned adjustments. These issues compound and eventually teams stop trusting reports.',
        `Avoid this by making workflows consistent and using the system as the single source of truth. The fastest path to value is operational discipline, not adding more dashboards.`,
      ],
      bullets: context.operationalExamples,
    },
  ];
}

export const FEATURES: Record<FeatureSlug, FeaturePageContent> = {
  'inventory-management-software': {
    slug: 'inventory-management-software',
    navLabel: 'Inventory Management',
    title: 'Inventory management software for modern B2B teams',
    seoTitle: 'Inventory Management Software for B2B Teams',
    seoDescription:
      'Run accurate, auditable inventory across locations with approvals, barcode scanning, batch/serial tracking, and reporting built for B2B operations.',
    primaryKeyword: 'inventory management software',
    secondaryKeywords: ['stock management system', 'multi warehouse inventory software', 'stock control software'],
    intro:
      'Inventory accuracy isn’t a “nice-to-have” for B2B teams—it’s the difference between profitable operations and constant firefighting. This inventory management software helps you standardize receiving, adjustments, transfers, and approvals so every movement is traceable and every report can be trusted.',
    sections: [
      {
        heading: 'Standardize how stock moves (and who can move it)',
        paragraphs: [
          'As teams grow, informal processes create hidden costs: mis-picks, late shipments, write-offs, and urgent purchasing. A stock management system should be more than a spreadsheet replacement—it should enforce a shared operational language.',
          'With role-based access and approval flows, you can define exactly who can receive stock, adjust quantities, transfer between warehouses, or confirm a sale. This reduces “silent edits” and gives leadership confidence in numbers.',
        ],
        bullets: [
          'Role-based access control (RBAC) for sensitive actions',
          'Approval workflow for high-impact adjustments',
          'Audit trail for every movement and decision',
        ],
      },
      {
        heading: 'Multi-warehouse inventory without the chaos',
        paragraphs: [
          'Multi warehouse inventory software is only useful if it prevents double-counting and ambiguity. Track inventory by warehouse and location, plan replenishment, and keep reporting consistent across your operation.',
          'When you run multiple sites, transfers are where errors multiply. A controlled transfer flow ensures both ends of the movement are reflected correctly and can be reviewed when discrepancies happen.',
        ],
        bullets: [
          'Warehouse/location-level visibility',
          'Controlled transfers between sites',
          'Consistent reporting and reconciliation',
        ],
      },
      {
        heading: 'Traceability built in: barcode, batch, and serial tracking',
        paragraphs: [
          'If you ship regulated, serialized, or perishable items, traceability is not optional. Barcode inventory reduces manual entry mistakes, while batch and serial number tracking makes every unit accountable.',
          'Whether you need recall readiness or simply want to know what was shipped, to whom, and from which lot, structured traceability improves customer trust and operational clarity.',
        ],
      },
      {
        heading: 'Reporting that matches how operators work',
        paragraphs: [
          'Inventory reports are only valuable when they reflect operational reality. Track adjustments, transfers, receiving, and sales confirmations with clear filters—so teams can answer “what changed?” quickly.',
          'With a consistent audit history, you can diagnose inventory drift, train teams on correct workflows, and align finance and operations on valuation assumptions.',
        ],
      },
      ...standardLongformSections({
        capability: 'inventory management software',
        decisionDrivers: ['RBAC permissions', 'approval workflows', 'audit trails'],
        operationalExamples: [
          'Don’t allow “misc adjustments” without reason codes or approvals',
          'Avoid transferring stock without clear in-transit accountability',
          'Ensure receiving is consistent (same fields, same steps, every time)',
        ],
      }),
    ],
    comparison: {
      heading: 'Inventory software vs generic tools',
      paragraphs: [
        'Generic tools can capture quantities, but they rarely enforce operational controls. The result is inconsistent data and unreliable decision-making.',
        'This inventory management system is designed around accountability: permissions, approvals, traceability, and auditability—core needs for B2B SaaS buyers.',
      ],
      table: [
        { label: 'Audit trail', generic: 'Often missing or manual', ours: 'Automatic, event-level history' },
        { label: 'Approvals', generic: 'Ad-hoc', ours: 'Configurable workflows and policies' },
        { label: 'Multi-warehouse', generic: 'Hard to reconcile', ours: 'Warehouse/location visibility + transfers' },
        { label: 'Traceability', generic: 'Limited', ours: 'Barcode + batch/serial options' },
      ],
    },
    faq: COMMON_FAQ,
    cta: CTA,
    related: [
      'warehouse-management-system',
      'barcode-inventory-system',
      'batch-serial-tracking-software',
      'inventory-approval-workflow',
    ],
  },
  'warehouse-management-system': {
    slug: 'warehouse-management-system',
    navLabel: 'Warehouse Management',
    title: 'Warehouse management system for multi-location inventory',
    seoTitle: 'Warehouse Management System for Multi-Warehouse Control',
    seoDescription:
      'Coordinate receiving, transfers, and stock visibility across warehouses with role-based controls, audit trails, and operational reporting for B2B teams.',
    primaryKeyword: 'warehouse management system',
    secondaryKeywords: ['multi warehouse inventory software', 'stock management system', 'warehouse inventory tracking'],
    intro:
      'A warehouse management system should do two things exceptionally well: keep inventory accurate at every location and make stock movements predictable. This WMS approach focuses on operational control—so receiving, transfers, and adjustments are consistent across the team.',
    sections: [
      {
        heading: 'Location-level visibility that operators trust',
        paragraphs: [
          'When inventory is spread across warehouses, accuracy depends on clarity: what’s on-hand, what’s reserved, and what’s in transit. A WMS must present this information in a way that aligns with daily workflows.',
          'By treating warehouses as first-class entities and tracking movements between them, you reduce the number of “mystery variances” that appear during cycle counts.',
        ],
        bullets: [
          'Warehouse and location visibility',
          'Transfer flows with clear in-transit states',
          'Audit history for movement reconciliation',
        ],
      },
      {
        heading: 'Controlled receiving and putaway',
        paragraphs: [
          'Receiving is the first point where errors can enter the system. A standardized receiving flow ensures quantities, lot/serial details, and documentation are captured consistently.',
          'With permissions and (where needed) approvals, you can prevent unintended changes and keep data aligned between teams handling purchasing and those operating the warehouse.',
        ],
      },
      {
        heading: 'Transfers without double-counting',
        paragraphs: [
          'Transfers are often a source of inaccurate inventory because systems either “teleport” stock or rely on manual adjustments. A strong transfer workflow keeps both sides of the movement explicit.',
          'This improves planning and reduces customer impact when inventory is assumed to exist in the wrong place.',
        ],
      },
      {
        heading: 'Operational reporting for warehouse decisions',
        paragraphs: [
          'Warehouse software should provide operators and managers a shared view: what moved, why it moved, and who approved it. This supports continuous improvement and training.',
          'With a consistent audit trail, you can quickly investigate discrepancies instead of spending hours reconstructing events from multiple sources.',
        ],
      },
      ...standardLongformSections({
        capability: 'a warehouse management system',
        decisionDrivers: ['multi-warehouse visibility', 'controlled transfers', 'movement audit history'],
        operationalExamples: [
          'Make transfers explicit—avoid “teleporting” inventory between locations',
          'Standardize receiving to reduce downstream discrepancies',
          'Use permissions to prevent accidental edits to critical stock',
        ],
      }),
    ],
    comparison: {
      heading: 'WMS vs basic warehouse spreadsheets',
      paragraphs: [
        'Spreadsheets can track quantities, but they can’t enforce process. That leads to drift and unreliable replenishment decisions.',
        'A WMS approach built around permissions, approvals, and movement history makes data reliable enough for planning and finance alignment.',
      ],
      table: [
        { label: 'Transfers', generic: 'Manual edits', ours: 'Defined workflow + audit trail' },
        { label: 'Permissions', generic: 'None', ours: 'RBAC by role' },
        { label: 'Receiving', generic: 'Inconsistent', ours: 'Standardized flow' },
        { label: 'Visibility', generic: 'Lagging/partial', ours: 'Warehouse-level clarity' },
      ],
    },
    faq: COMMON_FAQ,
    cta: CTA,
    related: ['inventory-management-software', 'barcode-inventory-system', 'reorder-forecasting-software'],
  },
  'batch-serial-tracking-software': {
    slug: 'batch-serial-tracking-software',
    navLabel: 'Batch & Serial Tracking',
    title: 'Batch and serial tracking software for traceability',
    seoTitle: 'Batch Tracking & Serial Number Tracking Software',
    seoDescription:
      'Track lots and serial numbers end-to-end with an auditable inventory system built for regulated, high-value, and quality-sensitive B2B operations.',
    primaryKeyword: 'batch tracking software',
    secondaryKeywords: ['serial number tracking software', 'traceability software', 'inventory tracking system'],
    intro:
      'Batch and serial tracking software is how you protect margins and customer trust when traceability matters. Whether you manage expiry-sensitive inventory, high-value assets, or compliance-driven workflows, traceable stock movements reduce risk and speed up investigations.',
    sections: [
      {
        heading: 'Know what you received—down to the lot or unit',
        paragraphs: [
          'If batches and serial numbers are captured inconsistently, traceability becomes a false sense of security. A robust process starts at receiving and continues through transfers, adjustments, and sales confirmation.',
          'When every movement references the right batch/serial details, teams can answer “where did this come from?” and “where did it go?” in minutes.',
        ],
      },
      {
        heading: 'Recall readiness and quality control',
        paragraphs: [
          'In a recall or quality incident, speed matters. With proper batch tracking, you can identify impacted inventory and customers quickly—reducing disruption and protecting brand credibility.',
          'Serial number tracking also supports warranties and service workflows by tying each unit to a history of movements and ownership.',
        ],
        bullets: [
          'Faster investigation and containment',
          'Better warranty/service tracking',
          'Reduced write-offs from unclear provenance',
        ],
      },
      {
        heading: 'Traceability + approvals = controlled risk',
        paragraphs: [
          'Traceability is strongest when it’s paired with controlled workflows. Approvals for adjustments and sensitive actions prevent “fixes” that destroy the chain of custody.',
          'Audit trails ensure traceability isn’t dependent on tribal knowledge or one person’s spreadsheet.',
        ],
      },
      {
        heading: 'Reporting for compliance and operations',
        paragraphs: [
          'Operators need fast answers; compliance teams need evidence. With structured movement history, both are supported using the same source of truth.',
          'This reduces time spent preparing reports and improves confidence in operational KPIs.',
        ],
      },
      ...standardLongformSections({
        capability: 'batch and serial tracking software',
        decisionDrivers: ['traceability capture points', 'auditability', 'exception controls'],
        operationalExamples: [
          'Don’t make batch/serial capture optional in receiving workflows',
          'Prevent “silent fixes” that break the traceability chain',
          'Validate that reports can answer “where did this lot/unit go?” quickly',
        ],
      }),
    ],
    comparison: {
      heading: 'Traceable inventory vs non-traceable tracking',
      paragraphs: [
        'Non-traceable systems can only tell you totals. When something goes wrong, you’re forced into expensive manual investigation.',
        'Batch/serial tracking adds accountability at the item level—critical for regulated or high-value inventory.',
      ],
      table: [
        { label: 'Recall response', generic: 'Slow, manual', ours: 'Lot/unit-level identification' },
        { label: 'Warranty tracking', generic: 'Hard to prove', ours: 'Serial-level history' },
        { label: 'Auditability', generic: 'Partial', ours: 'Movement-level audit trail' },
        { label: 'Risk', generic: 'Higher', ours: 'Controlled processes + traceability' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'Do we need batch or serial tracking?',
        answer:
          'Use batch tracking for groups of items (lots) like perishables or manufacturing runs. Use serial tracking for unique units like devices, equipment, or regulated items requiring unit-level history.',
      },
    ],
    cta: CTA,
    related: ['barcode-inventory-system', 'fifo-inventory-software', 'inventory-management-software'],
  },
  'fifo-inventory-software': {
    slug: 'fifo-inventory-software',
    navLabel: 'FIFO Inventory',
    title: 'FIFO inventory software for accurate stock rotation',
    seoTitle: 'FIFO Inventory Software for Expiry-Sensitive Stock',
    seoDescription:
      'Reduce waste and stockouts with FIFO inventory controls, traceability-friendly workflows, and reporting that supports predictable B2B fulfillment.',
    primaryKeyword: 'fifo inventory software',
    secondaryKeywords: ['inventory rotation', 'stock control software', 'warehouse management system'],
    intro:
      'FIFO inventory software helps teams ship older stock first, reducing expiry losses and improving customer experience. When FIFO is supported by traceability and disciplined workflows, inventory becomes more predictable across warehouses and teams.',
    sections: [
      {
        heading: 'Prevent waste with consistent stock rotation',
        paragraphs: [
          'FIFO is simple in theory but hard in practice when teams are under pressure. A system that supports FIFO makes it easier to pick the right inventory without slowing operations.',
          'For expiry-sensitive items, FIFO reduces write-offs and supports stronger service levels by keeping stock fresh and predictable.',
        ],
        bullets: ['Reduced expiry loss', 'More predictable fulfillment', 'Improved inventory hygiene'],
      },
      {
        heading: 'FIFO works best with batch tracking',
        paragraphs: [
          'When batches and expiry dates are captured consistently, FIFO becomes enforceable. Batch tracking also improves recall readiness and quality investigations.',
          'FIFO isn’t only about “oldest first”—it’s about operational consistency and confident allocation decisions.',
        ],
      },
      {
        heading: 'Multi-warehouse FIFO without confusion',
        paragraphs: [
          'In multi-warehouse operations, FIFO can break if transfers and adjustments are inconsistent. By standardizing movements and tracking history, FIFO policies remain practical at scale.',
          'This also improves how purchasing teams forecast and replenish inventory across locations.',
        ],
      },
      {
        heading: 'Reporting that supports replenishment and planning',
        paragraphs: [
          'FIFO-focused reporting helps teams identify aging stock, high-risk SKUs, and slow-moving inventory. These insights inform smarter purchasing and sales strategies.',
          'A consistent audit trail turns inventory data into a reliable planning input, not an afterthought.',
        ],
      },
      ...standardLongformSections({
        capability: 'FIFO inventory software',
        decisionDrivers: ['consistent picking rules', 'batch-aware processes', 'multi-warehouse hygiene'],
        operationalExamples: [
          'Avoid ad-hoc picking that ships the “closest” stock first',
          'Capture batch/expiry details early to keep FIFO enforceable',
          'Keep transfers and adjustments disciplined to prevent aging blind spots',
        ],
      }),
    ],
    comparison: {
      heading: 'FIFO inventory vs ad-hoc picking',
      paragraphs: [
        'Ad-hoc picking often ships the “closest” or “easiest” stock first, which increases expiry risk and creates hidden write-offs.',
        'FIFO controls add discipline without adding unnecessary operator burden.',
      ],
      table: [
        { label: 'Expiry loss', generic: 'Higher', ours: 'Reduced with FIFO discipline' },
        { label: 'Consistency', generic: 'Varies by person', ours: 'Standardized workflows' },
        { label: 'Traceability', generic: 'Limited', ours: 'Batch/serial-ready processes' },
        { label: 'Planning', generic: 'Reactive', ours: 'Better aging visibility' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'Is FIFO required if we don’t have expiry dates?',
        answer:
          'Not always, but FIFO can still improve consistency and reduce shrinkage for high-volume SKUs. If you have perishable or time-sensitive stock, FIFO becomes much more important.',
      },
    ],
    cta: CTA,
    related: ['batch-serial-tracking-software', 'warehouse-management-system', 'reorder-forecasting-software'],
  },
  'inventory-valuation-software': {
    slug: 'inventory-valuation-software',
    navLabel: 'Inventory Valuation',
    title: 'Inventory valuation software with audit-ready history',
    seoTitle: 'Inventory Valuation Software with Audit-Ready Reporting',
    seoDescription:
      'Keep finance and operations aligned with consistent inventory history, controlled adjustments, and reports that support accurate inventory valuation.',
    primaryKeyword: 'inventory valuation software',
    secondaryKeywords: ['stock valuation', 'inventory reports', 'audit trail'],
    intro:
      'Inventory valuation is only as accurate as the movement history behind it. Inventory valuation software should make it easy to explain changes, control adjustments, and produce reports that both finance and operations trust.',
    sections: [
      {
        heading: 'Reduce valuation surprises with controlled adjustments',
        paragraphs: [
          'Uncontrolled adjustments are a common source of valuation variance. With permissions and approvals, sensitive changes can be reviewed before they affect financial reporting.',
          'This helps avoid end-of-month “fire drills” where teams reconcile numbers across systems and spreadsheets.',
        ],
        bullets: ['Approval workflow for adjustments', 'RBAC for sensitive actions', 'Clear movement history'],
      },
      {
        heading: 'A single movement history for finance and operations',
        paragraphs: [
          'When finance and operations use different sources of truth, valuation becomes a negotiation. A unified audit trail reduces disagreement and speeds reconciliation.',
          'Operators can see what happened; finance can validate why it happened—without manual reconstruction.',
        ],
      },
      {
        heading: 'Reporting designed for investigation',
        paragraphs: [
          'Good reports do more than show totals—they help answer questions quickly. Filter movements by warehouse, time period, SKU, and movement type to isolate the root cause of variance.',
          'This supports stronger controls and ongoing process improvements across teams.',
        ],
      },
      {
        heading: 'Valuation-ready inventory hygiene',
        paragraphs: [
          'Accurate valuation depends on consistent receiving, transfers, and sales confirmations. When processes are standardized, valuation is a natural output rather than a monthly project.',
          'This is especially important for B2B teams with multiple warehouses and complex purchasing cycles.',
        ],
      },
      ...standardLongformSections({
        capability: 'inventory valuation software',
        decisionDrivers: ['controlled adjustments', 'explainable movement history', 'reconciliation-friendly reporting'],
        operationalExamples: [
          'Require approvals for large or sensitive adjustments',
          'Avoid mixing “real movements” with manual fixes outside the system',
          'Use consistent movement reasons to speed investigation',
        ],
      }),
    ],
    comparison: {
      heading: 'Valuation-ready inventory vs fragmented tracking',
      paragraphs: [
        'Fragmented tracking creates gaps and uncertainty. Even if totals look correct, the “why” behind changes is often missing.',
        'A valuation-ready system emphasizes auditability and controlled workflows.',
      ],
      table: [
        { label: 'Reconciliation time', generic: 'High', ours: 'Lower with consistent audit trail' },
        { label: 'Adjustment control', generic: 'Loose', ours: 'RBAC + approvals' },
        { label: 'Explainability', generic: 'Manual', ours: 'Movement-level history' },
        { label: 'Confidence', generic: 'Varies', ours: 'Consistent and reviewable' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'Does this replace accounting software?',
        answer:
          'No. It’s designed to make inventory movement data accurate and auditable, so downstream financial reporting and valuation workflows can be more reliable.',
      },
    ],
    cta: CTA,
    related: ['inventory-approval-workflow', 'inventory-management-software', 'warehouse-management-system'],
  },
  'inventory-approval-workflow': {
    slug: 'inventory-approval-workflow',
    navLabel: 'Approvals',
    title: 'Inventory approval workflow to control risk',
    seoTitle: 'Inventory Approval Workflow for Controlled Operations',
    seoDescription:
      'Prevent costly inventory mistakes with approval workflows, RBAC permissions, and audit trails that bring accountability to stock movements in B2B teams.',
    primaryKeyword: 'inventory approval workflow',
    secondaryKeywords: ['inventory approvals', 'rbac inventory system', 'audit trail inventory'],
    intro:
      'An inventory approval workflow is how growing teams maintain control without slowing down operations. Approvals provide checks and balances for high-impact movements—so adjustments, transfers, and confirmations are accountable and auditable.',
    sections: [
      {
        heading: 'Reduce costly mistakes without blocking daily work',
        paragraphs: [
          'Not every action should require approval. The goal is to add friction only where the cost of mistakes is high: large adjustments, sensitive SKUs, or exceptional transfers.',
          'With the right workflow, operators can do their work while managers review riskier changes in a structured queue.',
        ],
        bullets: ['Targeted approvals by policy', 'Clear queues for reviewers', 'Audit-ready decision history'],
      },
      {
        heading: 'RBAC: permissions that match job roles',
        paragraphs: [
          'RBAC is the foundation for an approval-based process. When roles are defined clearly, you reduce accidental exposure and ensure changes are made by the right people.',
          'This supports separation of duties—important for B2B operations with compliance requirements or strong governance.',
        ],
      },
      {
        heading: 'Audit trails that make approvals meaningful',
        paragraphs: [
          'Approvals only matter if the system records what changed, who requested it, and who approved it. That history helps teams investigate issues and continuously improve processes.',
          'Over time, approval data can also highlight training needs and recurring sources of error.',
        ],
      },
      {
        heading: 'Operational trust: leadership can rely on inventory numbers',
        paragraphs: [
          'When inventory is controlled, planning becomes easier. Purchasing decisions improve, customer commitments are more reliable, and financial reporting aligns more closely with operational reality.',
          'Approval workflows are a key step toward operational maturity as teams scale.',
        ],
      },
      ...standardLongformSections({
        capability: 'an inventory approval workflow',
        decisionDrivers: ['policy-driven approvals', 'role-based permissions', 'decision audit trails'],
        operationalExamples: [
          'Avoid approvals that are too broad—target the highest-risk actions',
          'Don’t approve changes without capturing the “why” (reason and evidence)',
          'Ensure approvals don’t live in chats—keep decisions centralized',
        ],
      }),
    ],
    comparison: {
      heading: 'Approvals vs informal “check with me” processes',
      paragraphs: [
        'Informal approvals create delays and missing history. A structured workflow keeps requests visible and decisions traceable.',
        'This reduces dependency on specific individuals and improves consistency across shifts and locations.',
      ],
      table: [
        { label: 'Visibility', generic: 'Messages/spreadsheets', ours: 'Central approval queue' },
        { label: 'Auditability', generic: 'Partial', ours: 'Request + decision history' },
        { label: 'Governance', generic: 'Inconsistent', ours: 'Policy-driven controls' },
        { label: 'Scalability', generic: 'Person-dependent', ours: 'Role-based and repeatable' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'What should require approval?',
        answer:
          'Typically: large quantity/value adjustments, sensitive SKUs, write-offs, and exceptional transfers. The best policy depends on your risk profile and team structure.',
      },
    ],
    cta: CTA,
    related: ['inventory-management-software', 'inventory-valuation-software', 'warehouse-management-system'],
  },
  'barcode-inventory-system': {
    slug: 'barcode-inventory-system',
    navLabel: 'Barcode System',
    title: 'Barcode inventory system that reduces manual errors',
    seoTitle: 'Barcode Inventory System for Faster, Accurate Stock Control',
    seoDescription:
      'Speed up receiving and stock movements with barcode scanning that reduces human error, improves traceability, and supports reliable B2B inventory operations.',
    primaryKeyword: 'barcode inventory system',
    secondaryKeywords: ['barcode stock control', 'inventory tracking', 'warehouse management system'],
    intro:
      'A barcode inventory system improves accuracy by turning manual typing into scanning. For B2B teams, that means fewer pick/receive mistakes, cleaner audit history, and faster workflows across warehouses.',
    sections: [
      {
        heading: 'Replace error-prone typing with scanning',
        paragraphs: [
          'Manual entry is one of the biggest drivers of inventory errors. Barcoding reduces wrong-SKU mistakes, mismatched quantities, and inconsistent naming conventions.',
          'When scanning is integrated into the workflow, data quality improves without adding administrative overhead.',
        ],
        bullets: ['Fewer wrong-SKU errors', 'Faster receiving and adjustments', 'Cleaner product identification'],
      },
      {
        heading: 'Barcodes support traceability (batch/serial ready)',
        paragraphs: [
          'Barcode workflows pair naturally with batch and serial tracking. When teams scan items consistently, traceability data stays complete and useful.',
          'This is valuable for regulated items, high-value assets, and operations that need recall readiness.',
        ],
      },
      {
        heading: 'Better accountability with audit trails',
        paragraphs: [
          'Scanning workflows create consistent events in the system. Combined with permissions and approvals, this makes movements easier to investigate and explain.',
          'For B2B teams, that accountability is often a key buyer requirement—especially at scale.',
        ],
      },
      {
        heading: 'Faster onboarding for warehouse staff',
        paragraphs: [
          'Barcoding reduces training time because the process is more guided and less dependent on memorizing product details.',
          'This helps teams maintain consistent operations across shifts, sites, and seasonal staffing changes.',
        ],
      },
      ...standardLongformSections({
        capability: 'a barcode inventory system',
        decisionDrivers: ['workflow-integrated scanning', 'data consistency', 'operator onboarding speed'],
        operationalExamples: [
          'Don’t bolt scanning on as an afterthought—embed it in receiving and movement steps',
          'Avoid inconsistent SKU naming that makes scanning unreliable',
          'Ensure exception handling is clear when scans don’t match expectations',
        ],
      }),
    ],
    comparison: {
      heading: 'Barcode scanning vs manual inventory tracking',
      paragraphs: [
        'Manual tracking increases the chance of small errors that compound over time. Barcoding shifts accuracy from “best effort” to “built-in”.',
        'For growing B2B teams, it’s a practical step toward operational maturity.',
      ],
      table: [
        { label: 'Speed', generic: 'Slower', ours: 'Faster scanning workflows' },
        { label: 'Accuracy', generic: 'Depends on operator', ours: 'Higher by design' },
        { label: 'Traceability', generic: 'Hard to keep complete', ours: 'Consistent capture points' },
        { label: 'Training', generic: 'Longer', ours: 'Faster onboarding' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'Do we need special barcode hardware?',
        answer:
          'Not necessarily. Many teams start with mobile device cameras and scale to dedicated scanners as volume increases, depending on workflow and environment.',
      },
    ],
    cta: CTA,
    related: ['warehouse-management-system', 'batch-serial-tracking-software', 'inventory-management-software'],
  },
  'reorder-forecasting-software': {
    slug: 'reorder-forecasting-software',
    navLabel: 'Reorder & Forecasting',
    title: 'Reorder forecasting software for predictable purchasing',
    seoTitle: 'Reorder Forecasting Software to Reduce Stockouts',
    seoDescription:
      'Improve replenishment decisions with clear inventory visibility, multi-warehouse context, and operational reporting designed for B2B stock planning.',
    primaryKeyword: 'reorder forecasting software',
    secondaryKeywords: ['reorder point', 'inventory forecasting', 'stock management system'],
    intro:
      'Reorder forecasting software helps teams avoid stockouts and reduce excess inventory. The foundation is reliable movement history: when inventory data is clean and workflows are controlled, planning gets dramatically easier.',
    sections: [
      {
        heading: 'Better decisions start with reliable inventory data',
        paragraphs: [
          'Forecasting is only as strong as the inventory data behind it. If adjustments are uncontrolled or transfers are inconsistent, reorder recommendations become noise.',
          'With audit trails and standardized processes, stock levels become dependable inputs for planning and purchasing.',
        ],
      },
      {
        heading: 'Multi-warehouse context prevents overbuying',
        paragraphs: [
          'In multi-warehouse operations, stock might exist—just not where you need it. A system that surfaces location context helps teams transfer instead of overbuying.',
          'This reduces cash tied up in inventory and improves fulfillment performance.',
        ],
        bullets: ['Avoid duplicate replenishment', 'Use transfers strategically', 'Improve service levels'],
      },
      {
        heading: 'Operational reporting for planning cycles',
        paragraphs: [
          'Replenishment planning benefits from clear reporting on movements, exceptions, and adjustments. That visibility supports more accurate reorder policies over time.',
          'Teams can also identify which SKUs cause recurring issues and improve catalog hygiene.',
        ],
      },
      {
        heading: 'From reactive to predictable purchasing',
        paragraphs: [
          'The goal is predictable outcomes: fewer emergency orders, fewer missed customer commitments, and less warehouse congestion from last-minute inbound stock.',
          'When your inventory system is consistent, forecasting becomes an operational advantage—not a guess.',
        ],
      },
      ...standardLongformSections({
        capability: 'reorder forecasting software',
        decisionDrivers: ['reliable stock history', 'multi-warehouse context', 'reporting for exceptions'],
        operationalExamples: [
          'Avoid forecasting on drifting inventory data—fix workflow discipline first',
          'Don’t reorder without checking stock in other warehouses first',
          'Track recurring exceptions (adjustments, shrinkage) to improve planning policies',
        ],
      }),
    ],
    comparison: {
      heading: 'Forecasting with clean data vs forecasting with drift',
      paragraphs: [
        'Forecasting on drifting inventory data leads to poor decisions and low trust in the system.',
        'A controlled stock management system improves both the recommendations and the team’s confidence in them.',
      ],
      table: [
        { label: 'Stockouts', generic: 'More frequent', ours: 'Reduced with better visibility' },
        { label: 'Overstock', generic: 'Common', ours: 'Lower with multi-warehouse context' },
        { label: 'Trust', generic: 'Low', ours: 'Higher with auditability' },
        { label: 'Planning time', generic: 'High', ours: 'Lower with consistent reporting' },
      ],
    },
    faq: [
      ...COMMON_FAQ,
      {
        question: 'Do you provide automatic forecasting?',
        answer:
          'This implementation focuses on the operational foundations for forecasting: clean stock history, multi-warehouse visibility, and reporting. Advanced forecasting can be layered on once the data is reliable.',
      },
    ],
    cta: CTA,
    related: ['inventory-management-software', 'warehouse-management-system', 'inventory-valuation-software'],
  },
} as const;

