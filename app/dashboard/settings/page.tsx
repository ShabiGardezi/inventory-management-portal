'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsSkeleton } from '@/components/settings/settings-skeleton';
import { ProfileSection } from '@/components/settings/profile-section';
import { OrganizationSection } from '@/components/settings/organization-section';
import { InventorySection } from '@/components/settings/inventory-section';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { RolesAuditSystemSection } from '@/components/settings/roles-audit-system-section';
import { ApprovalPoliciesSection } from '@/components/settings/approval-policies-section';
import type { SettingsResponse } from '@/lib/settings-types';
import { User, Building2, Package, Bell, Shield, ClipboardCheck } from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [rolesSummary, setRolesSummary] = useState<{ rolesCount: number; permissionsCount: number } | undefined>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!data?.permissions) return;
    const hasSettingsRead = data.permissions.includes('settings.read');
    if (hasSettingsRead) {
      fetch('/api/warehouses?limit=100')
        .then((r) => r.ok ? r.json() : null)
        .then((j) => j?.list?.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name })) ?? [])
        .then(setWarehouses)
        .catch(() => setWarehouses([]));
    }
    if (data.permissions.includes('roles.manage') || data.permissions.includes('roles.read')) {
      fetch('/api/roles?pageSize=1')
        .then((r) => r.ok ? r.json() : null)
        .then((res: { total?: number; rows?: unknown[] } | unknown[] | null) => {
          if (!res) return;
          const count = Array.isArray(res) ? res.length : (res as { total?: number }).total ?? 0;
          setRolesSummary({ rolesCount: count, permissionsCount: 0 });
        })
        .catch(() => {});
    }
  }, [data?.permissions]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage system and profile settings.</p>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  const permissions = data.permissions ?? [];
  const hasSettingsRead = permissions.includes('settings.read');
  const hasSettingsUpdate = permissions.includes('settings.update');
  const canUpdateEmail = permissions.includes('users.update');
  const canManageRoles = permissions.includes('roles.manage');
  const canReadAudit = permissions.includes('audit.read') || permissions.includes('audit:read');
  const canReadReports = permissions.includes('reports.read');
  const canManageApprovals = permissions.includes('approvals.manage');

  const defaultOrg = {
    companyName: null,
    businessEmail: null,
    phone: null,
    address: null,
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    invoicePrefix: null,
    invoiceNumberPattern: null,
    defaultTaxRate: null,
  };
  const defaultInv = {
    allowNegativeStock: false,
    enforceReorderLevelAlerts: true,
    defaultWarehouseId: null,
    stockAdjustmentReasons: [],
    enableBarcode: false,
    quantityPrecision: 'integer',
    lowStockThresholdBehavior: 'reorderLevel',
  };
  const defaultNotif = {
    lowStockNotificationsEnabled: true,
    dailySummaryEmailEnabled: false,
    weeklySummaryEmailEnabled: false,
    notificationRecipientEmails: [],
    inAppNotificationsEnabled: true,
  };

  const organization = data.organization ?? defaultOrg;
  const inventory = data.inventory ?? defaultInv;
  const notifications = data.notifications ?? defaultNotif;

  const showOrg = hasSettingsRead;
  const showInv = hasSettingsRead;
  const showNotif = hasSettingsRead;
  const showRolesAudit = canManageRoles || canReadAudit || canReadReports;
  const showApprovalPolicies = canManageApprovals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage system and profile settings.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Profile
          </TabsTrigger>
          {showOrg && (
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
          )}
          {showInv && (
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory
            </TabsTrigger>
          )}
          {showNotif && (
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          )}
          {showRolesAudit && (
            <TabsTrigger value="roles-audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Roles & Audit
            </TabsTrigger>
          )}
          {showApprovalPolicies && (
            <TabsTrigger value="approval-policies" className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Approval Policies
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <ProfileSection
            profile={data.profile}
            canUpdateEmail={canUpdateEmail}
            onSaved={refetch}
          />
        </TabsContent>

        {showOrg && (
          <TabsContent value="organization">
            <OrganizationSection
              data={organization}
              canUpdate={hasSettingsUpdate}
              onSaved={refetch}
            />
          </TabsContent>
        )}

        {showInv && (
          <TabsContent value="inventory">
            <InventorySection
              data={inventory}
              canUpdate={hasSettingsUpdate}
              warehouses={warehouses}
              onSaved={refetch}
            />
          </TabsContent>
        )}

        {showNotif && (
          <TabsContent value="notifications">
            <NotificationsSection
              data={notifications}
              canUpdate={hasSettingsUpdate}
              onSaved={refetch}
            />
          </TabsContent>
        )}

        {showRolesAudit && (
          <TabsContent value="roles-audit">
            <RolesAuditSystemSection
              canManageRoles={canManageRoles}
              canReadAudit={canReadAudit}
              canReadReports={canReadReports}
              rolesSummary={rolesSummary}
            />
          </TabsContent>
        )}

        {showApprovalPolicies && (
          <TabsContent value="approval-policies">
            <ApprovalPoliciesSection />
          </TabsContent>
        )}
      </Tabs>

      {activeTab && !['profile', 'organization', 'inventory', 'notifications', 'roles-audit', 'approval-policies'].includes(activeTab) && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">You don&apos;t have access to this section.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
