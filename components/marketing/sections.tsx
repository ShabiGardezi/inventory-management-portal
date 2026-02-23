import Link from 'next/link';

export function TrustIndicators() {
  return (
    <section className="border-y bg-muted/20">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="text-sm font-semibold">Operational controls</div>
          <p className="mt-2 text-sm text-muted-foreground">
            RBAC permissions, approvals, and audit trails designed for B2B accountability.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold">Traceability-ready</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Barcode workflows plus batch and serial tracking for quality-sensitive inventory.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold">Multi-warehouse clarity</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Track by warehouse, manage transfers, and report consistently across locations.
          </p>
        </div>
      </div>
    </section>
  );
}

export function CtaSection({
  heading,
  body,
  primaryCtaHref,
  primaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaLabel,
}: {
  heading: string;
  body: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref: string;
  secondaryCtaLabel: string;
}) {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-xl border bg-card p-8 md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{body}</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 md:mt-0 md:flex-row">
            <Link
              href={primaryCtaHref}
              className="rounded-md bg-primary px-5 py-2 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {primaryCtaLabel}
            </Link>
            <Link
              href={secondaryCtaHref}
              className="rounded-md border px-5 py-2 text-center text-sm font-medium hover:bg-muted"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.question} className="rounded-lg border bg-card p-5">
              <h3 className="font-medium">{item.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComparisonTable({
  heading,
  paragraphs,
  rows,
}: {
  heading: string;
  paragraphs: string[];
  rows: Array<{ label: string; generic: string; ours: string }>;
}) {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm text-muted-foreground">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">Capability</th>
                <th className="p-3 font-medium">Generic alternatives</th>
                <th className="p-3 font-medium">This platform</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="p-3 font-medium">{row.label}</td>
                  <td className="p-3 text-muted-foreground">{row.generic}</td>
                  <td className="p-3 text-muted-foreground">{row.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

