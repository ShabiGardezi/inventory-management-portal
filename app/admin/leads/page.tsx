import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hasPermission } from '@/lib/rbac';
import type { LeadStatus, LeadType } from '@prisma/client';
import { updateLeadStatus } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type PageProps = {
  searchParams: Promise<{
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    leadId?: string;
  }>;
};

function parseLeadStatus(value: string | undefined): LeadStatus | undefined {
  if (!value) return undefined;
  if (value === 'NEW' || value === 'CONTACTED' || value === 'CLOSED') return value;
  return undefined;
}

function parseLeadType(value: string | undefined): LeadType | undefined {
  if (!value) return undefined;
  if (value === 'DEMO' || value === 'CONTACT') return value;
  return undefined;
}

function toDateStart(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function statusBadgeVariant(status: LeadStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'NEW') return 'default';
  if (status === 'CONTACTED') return 'secondary';
  return 'destructive';
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/admin/leads');
  if (!hasPermission(user, 'leads.read')) redirect('/dashboard/access-denied');

  const status = parseLeadStatus(sp.status);
  const type = parseLeadType(sp.type);
  const from = toDateStart(sp.from);
  const to = toDateStart(sp.to);

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  } as const;

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      type: true,
      status: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      country: true,
      companySize: true,
      message: true,
      marketingOptIn: true,
      consentAccepted: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      pagePath: true,
      createdAt: true,
    },
  });

  const activeLead = sp.leadId ? leads.find((l) => l.id === sp.leadId) : undefined;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">Demo requests and contact submissions from the marketing site.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-md border px-3 py-1 hover:bg-muted" href="/admin/leads">
            All
          </Link>
          <Link className="rounded-md border px-3 py-1 hover:bg-muted" href="/admin/leads?status=NEW">
            New
          </Link>
          <Link className="rounded-md border px-3 py-1 hover:bg-muted" href="/admin/leads?type=DEMO">
            Demo
          </Link>
          <Link className="rounded-md border px-3 py-1 hover:bg-muted" href="/admin/leads?type=CONTACT">
            Contact
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Company / Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.type}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(l.status)}>{l.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{l.company ?? l.name}</div>
                        <div className="text-xs text-muted-foreground">{l.email}</div>
                      </TableCell>
                      <TableCell>{l.country}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.createdAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link className="underline" href={`/admin/leads?leadId=${encodeURIComponent(l.id)}`}>
                          Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                        No leads found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeLead ? (
              <p className="text-sm text-muted-foreground">Select a lead to view details.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-sm font-medium">{activeLead.company ?? activeLead.name}</div>
                  <div className="text-xs text-muted-foreground">{activeLead.email}</div>
                  {activeLead.phone ? <div className="text-xs text-muted-foreground">{activeLead.phone}</div> : null}
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{activeLead.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">{activeLead.status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Country</span>
                    <span className="font-medium">{activeLead.country}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Company size</span>
                    <span className="font-medium">{activeLead.companySize ?? '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Opt-in</span>
                    <span className="font-medium">{activeLead.marketingOptIn ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">Message</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{activeLead.message}</p>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div>UTM: {activeLead.utmSource ?? '-'} / {activeLead.utmMedium ?? '-'} / {activeLead.utmCampaign ?? '-'}</div>
                  <div>Page: {activeLead.pagePath}</div>
                  <div>Timestamp: {activeLead.createdAt.toISOString()}</div>
                </div>

                <form
                  action={async () => {
                    'use server';
                    await updateLeadStatus({ id: activeLead.id, status: 'CONTACTED' });
                  }}
                >
                  <Button type="submit" className="w-full" variant="secondary">
                    Mark as CONTACTED
                  </Button>
                </form>
                <form
                  action={async () => {
                    'use server';
                    await updateLeadStatus({ id: activeLead.id, status: 'CLOSED' });
                  }}
                >
                  <Button type="submit" className="w-full" variant="destructive">
                    Mark as CLOSED
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

