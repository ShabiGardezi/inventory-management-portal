# Database Schema

## Overview

PostgreSQL via Prisma. Core areas: **RBAC** (users, roles, permissions), **Inventory** (products, warehouses, stock_movements, stock_balances), **Settings**, and **Audit**. There are **no separate Purchase or Sale tables** — purchase and sale events are represented as rows in `stock_movements` with `referenceType` PURCHASE or SALE.

---

## Core Tables and Relationships

### RBAC

```
users
  id (cuid), email (unique), name, passwordHash, isActive, emailVerified, createdAt, updatedAt

roles
  id (cuid), name (unique), description, isSystem, isActive, createdAt, updatedAt

permissions
  id (cuid), name (unique), resource, action, module, description, createdAt, updatedAt

user_roles
  id, userId (FK users), roleId (FK roles), createdAt, updatedAt
  @@unique([userId, roleId])

role_permissions
  id, roleId (FK roles), permissionId (FK permissions), createdAt, updatedAt
  @@unique([roleId, permissionId])
```

- A **user** has many **user_roles**; each **role** has many **role_permissions** (permission keys). The app resolves permissions by role and attaches them to the session (JWT).
- **role.name** examples: admin, manager, staff, viewer; custom: inventory_clerk, warehouse_lead, procurement, sales_rep, reports_only.

### Inventory

```
products
  id (cuid), sku (unique), name, description, category, unit, price, costPrice, reorderLevel, isActive,
  trackBatches (boolean, default false), trackSerials (boolean, default false), createdAt, updatedAt

warehouses
  id (cuid), code (unique, optional), name, address, city, country, isActive, createdAt, updatedAt

batches
  id (cuid), productId (FK products), batchNumber, mfgDate (optional), expiryDate (optional), notes, createdAt, updatedAt
  @@unique([productId, batchNumber])

product_serials
  id (cuid), productId (FK), serialNumber, status (IN_STOCK|SOLD|DAMAGED|RETURNED), warehouseId (FK, optional),
  batchId (FK, optional), movementId (FK, optional), acquiredAt, disposedAt, createdAt, updatedAt
  @@unique([productId, serialNumber])

stock_movements
  id (cuid), productId (FK), warehouseId (FK), movementType (IN|OUT|TRANSFER|ADJUSTMENT),
  quantity (Decimal, positive), referenceType (PURCHASE|SALE|TRANSFER|ADJUSTMENT|MANUAL),
  referenceId, referenceNumber, notes, createdById (FK users, optional),
  batchId (FK batches, optional), serialCount (int, optional), createdAt, updatedAt

stock_balances
  id (cuid), productId (FK), warehouseId (FK), batchId (FK batches, optional), quantity, reserved, available, lastUpdated, createdAt, updatedAt
  @@unique([productId, warehouseId, batchId])
```

- **products** — `trackBatches` and `trackSerials` enable batch/serial tracking; when true, IN/OUT must supply batch or serial data as per business rules.
- **batches** — One row per (productId, batchNumber); used when product.trackBatches is true. Movements and balances reference batchId.
- **product_serials** — One row per (productId, serialNumber); status and warehouseId updated on receive/transfer/sale. Used when product.trackSerials is true.
- **stock_movements** — Immutable ledger; every stock change is one (or two for transfer) new row(s). Optional `batchId` and `serialCount` for batch/serial tracking.
- **stock_balances** — One row per (productId, warehouseId, batchId); `batchId` null = non-batch balance. Updated only by `StockService` when creating movements. `available` = quantity - reserved.

### Settings (single-tenant)

```
settings
  id, scope (e.g. GLOBAL), tenantId (null for global),
  companyName, businessEmail, phone, address, timezone, currency, dateFormat,
  invoicePrefix, invoiceNumberPattern, defaultTaxRate,
  allowNegativeStock, enforceReorderLevelAlerts, defaultWarehouseId,
  stockAdjustmentReasons[], enableBarcode, quantityPrecision, lowStockThresholdBehavior,
  lowStockNotificationsEnabled, dailySummaryEmailEnabled, weeklySummaryEmailEnabled,
  notificationRecipientEmails[], inAppNotificationsEnabled,
  createdAt, updatedAt
  @@unique([scope, tenantId])

user_settings
  id, userId (unique, FK users), theme, tablePageSize, preferences (Json), createdAt, updatedAt
```

### Audit

```
audit_logs
  id (cuid), userId (FK users, optional), action (CREATE|UPDATE|DELETE|VIEW|LOGIN|LOGOUT|PERMISSION_DENIED),
  resource, resourceId, description, metadata (Json), ipAddress, userAgent, createdAt
```

---

## Key Constraints and Indexes

- **batches**: unique (productId, batchNumber); index on (productId, expiryDate).
- **product_serials**: unique (productId, serialNumber); indexes on (productId, status), (warehouseId, status).
- **stock_movements**: indexes on productId, warehouseId, movementType, createdAt, referenceNumber, createdById, batchId; composite (warehouseId, createdAt), (productId, createdAt), (movementType, createdAt).
- **stock_balances**: unique (productId, warehouseId, batchId); indexes on productId, warehouseId, batchId, available.
- **users**: index on email, isActive.
- **permissions**: index on name, (resource, action), module.
- **audit_logs**: indexes on userId, action, resource, resourceId, createdAt.

Foreign keys use `onDelete: Restrict` or `Cascade` as defined in the Prisma schema (e.g. User delete cascades to user_roles; Product/Warehouse restrict on stock_movements).

---

## Example Queries for Common Reports

**Movement trend (IN/OUT by day):**

```ts
// In dashboardRepo: group by date from stock_movements, sum IN vs OUT
await prisma.stockMovement.findMany({
  where: { createdAt: { gte: start, lte: end } },
  select: { movementType: true, quantity: true, createdAt: true },
});
// Then aggregate by date in app code.
```

**Sales vs purchases (value by day):**

```ts
// Movements with movementType IN (purchases) or OUT (sales), join product for price;
// group by date, sum quantity * price per type.
```

**Low stock products:**

```ts
// Sum stock_balances.available per product (group by productId), filter where sum < threshold
// (e.g. product.reorderLevel or global low_stock_threshold).
```

**Transfer pairs:**

```ts
// Movements where referenceType = 'TRANSFER', group by referenceId;
// expect exactly 2 rows per referenceId (one IN, one OUT, same quantity, same product).
```

---

## Multi-Tenant Notes

- Schema supports **tenantId** on `Settings` (scope + tenantId unique). Current implementation uses **single-tenant**: global settings with `tenantId: null`.
- Users and inventory tables do not have a tenantId column; multi-tenant would require adding tenant scope to products, warehouses, and movements and filtering all queries by tenant.
