'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditTable } from '@/components/audit-table';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit logs</h1>
        <p className="text-muted-foreground">
          System activity and change history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Filter by date range, action, or resource</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditTable />
        </CardContent>
      </Card>
    </div>
  );
}
