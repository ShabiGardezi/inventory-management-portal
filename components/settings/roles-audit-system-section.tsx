'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, FileCheck, Database, Plug } from 'lucide-react';

interface RolesAuditSystemSectionProps {
  canManageRoles: boolean;
  canReadAudit: boolean;
  canReadReports: boolean;
  rolesSummary?: { rolesCount: number; permissionsCount: number };
}

export function RolesAuditSystemSection({
  canManageRoles,
  canReadAudit,
  canReadReports,
  rolesSummary,
}: RolesAuditSystemSectionProps) {
  return (
    <div className="space-y-6">
      {canManageRoles && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles & Permissions
            </CardTitle>
            <CardDescription>
              Manage roles and permissions.
              {rolesSummary && (
                <> Total roles: {rolesSummary.rolesCount}, permissions: {rolesSummary.permissionsCount}.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/users">
              <Button variant="outline">Manage roles</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {canReadAudit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Audit & Compliance
            </CardTitle>
            <CardDescription>
              View audit logs for settings and system changes. Settings changes are logged with before/after values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/audit">
              <Button variant="outline">View audit logs</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {canReadReports && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data export
            </CardTitle>
            <CardDescription>Export data (reports). Use reports when available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>
              Export (use Reports when available)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrations
          </CardTitle>
          <CardDescription>
            Placeholder for future integrations. Not implemented yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Coming soon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
