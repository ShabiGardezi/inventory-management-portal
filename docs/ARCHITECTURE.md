# Architecture

## System Overview

The application is a **Next.js 15 (App Router)** full-stack app with **TypeScript**, **Prisma** (PostgreSQL), and **NextAuth (JWT)**. Business logic lives in **server/services** and **server/repositories**; the API and UI call into these layers.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React)                                                 │
│  app/ (pages, layouts), components/                             │
└────────────────────────────┬────────────────────────────────────┘
                             │ fetch /api/*
┌────────────────────────────▼────────────────────────────────────┐
│  Next.js API Routes (app/api/*)                                  │
│  requireAuth() / requirePermission() → service calls              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  server/services/  (business logic)                              │
│  StockService, UserService, DashboardService, ReportService...   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  server/repositories/  (data access)                            │
│  StockRepository, dashboardRepo, userRepo, reportRepo...        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Prisma → PostgreSQL                                             │
└─────────────────────────────────────────────────────────────────┘
```

- **API routes** — Authenticate (and optionally check permission), then delegate to a service. No business logic in route handlers.
- **Services** — Orchestrate workflows, enforce rules, call repositories. All stock changes go through `StockService`.
- **Repositories** — Prisma queries and writes. No permission checks; services assume the caller is authorized.

---

## Data Flow Between Modules

- **Dashboard** — `GET /api/dashboard?range=...` → `getDashboardData(user, range)` in `dashboardService`; uses `dashboardRepo` for summary, charts, and preview tables. Data is role-scoped (e.g. Viewer sees limited charts).
- **Products / Warehouses** — CRUD APIs use `userService`, `warehouse.service`, product APIs; repositories for DB access.
- **Stock** — Adjust: `POST /api/stock/adjust` → `StockService.adjustStock`. Transfer: `POST /api/stock/transfer` → `StockService.transferStock`. Movements list: `GET /api/stock/movements` → repository/list service.
- **Reports** — `GET /api/reports/*` (overview, inventory, movements, sales, purchases, audit, reorder-suggestions) → `reportService` / `reportRepo`; filters by warehouse, category, date range; export uses same data.
- **Users / Roles** — APIs use `userService`, `roleService`; permissions loaded with user session (NextAuth callbacks).
- **Audit** — `createAuditLog()` called from services (e.g. stock operations); list via `GET /api/audit` with permission `audit:read`.
- **Smart Reorder / Metrics** — `InventoryMetricsService` computes reorder metrics (avg daily sales, days of cover, suggested reorder qty, predicted stockout date) from `stock_movements` (OUT + SALE in date range) and `stock_balances`; results stored in `inventory_metrics`. Recalculation is triggered after sale confirm, purchase receive, stock adjust, or manually via Reports “Recalculate” or `POST /api/reports/recompute-metrics`. Dashboard and Reports read from `inventory_metrics`; no heavy recalculation on render.

---

## Stock Engine Design

### Balances and Movements (Ledger)

- **`stock_movements`** — Immutable ledger. Every change is an append-only row: IN, OUT, TRANSFER, ADJUSTMENT; optional referenceType (PURCHASE, SALE, TRANSFER, ADJUSTMENT, MANUAL) and referenceId/referenceNumber.
- **`stock_balances`** — Current state per (productId, warehouseId): quantity, reserved, available. Updated **only** inside `StockService` when creating movements (never direct SQL updates from outside).

Conceptually:

```
  SUM(movements IN - OUT) per (product, warehouse, batchId)  ===  stock_balance.quantity
```

Each balance row is keyed by (productId, warehouseId, batchId); `batchId` may be null for non-batch products. Movements carry `batchId` so the ledger sum is computed per key. The **verify-integrity** script groups by (productId, warehouseId, batchId) and checks that each balance matches the sum of movements with the same key; transfer pairs (same referenceId, one IN + one OUT, same quantity) are also validated.

### Why the Ledger Is Immutable

- **Audit** — History is never overwritten; you can always explain current balance from movements.
- **Integrity** — Recalculation from movements can detect drift; no “manual” balance edits.
- **Compliance** — Traceability for receiving, sales, and transfers.

### Where Stock Changes Happen

| Action | Entry point | Result |
|--------|-------------|--------|
| Adjust (increase/decrease/set) | `StockService.adjustStock` | 1 IN or OUT movement + balance update |
| Transfer | `StockService.transferStock` | 2 movements (OUT + IN), same referenceId + 2 balance updates |
| Receive purchase | `StockService.receivePurchase` | 1 IN movement (PURCHASE) + balance update |
| Confirm sale | `StockService.confirmSale` | 1 OUT movement (SALE) + balance update |

All of the above use the same repository methods: create movement, then update balance in the same transaction.

### Batch and Serial Tracking Integration

- **Product flags** — `Product.trackBatches` and `Product.trackSerials` are read by `StockService` (via `StockRepository.getProductTrackingFlags`) before each operation. When `trackBatches` is true, IN must receive `batchId` or `batchInput.batchNumber` (find-or-create via `batch.repository.findOrCreateBatch`); OUT and transfer must receive `batchId`. When `trackSerials` is true, IN may receive `serialNumbers` (creating `ProductSerial` rows with IN_STOCK); OUT and transfer must receive `serialNumbers` (length = quantity), and the service updates serial status/warehouse via `productSerial.repository`.
- **Balance key** — Balances are stored per (productId, warehouseId, batchId). Non-batch products use `batchId: null`. The same `StockRepository.getOrCreateStockBalance` / `updateStockBalance` methods accept an optional `batchId`; movements store `batchId` and optional `serialCount` for traceability.
- **Integrity** — `lib/verify-integrity` groups movements and balances by (productId, warehouseId, batchId) so sums match per key. No separate “batch ledger”; batches are referenced by movements and balances only.

---

## Caching / Refetch Strategy

- **No server-side cache layer** — Each request hits the DB via Prisma.
- **Client** — Dashboard and list pages refetch on range/filter change or after mutations (e.g. after adjust/transfer, the movements table refetches). No global client cache (e.g. no React Query in scope); simple `useEffect` + `fetch`.
- **Consistency** — Because balances are updated in the same transaction as movements, a fresh fetch after an action shows up-to-date data.

---

## Where Business Logic Lives

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Services** | `server/services/*.ts` | Workflows, validation, calling repositories; stock rules (negative stock, transfer atomicity). |
| **Repositories** | `server/repositories/*.ts` | Prisma calls; no permission checks. |
| **RBAC** | `lib/rbac.ts` | `hasPermission`, `hasRole`, `requireAuth`, `requirePermission`. Used in API and in services (e.g. dashboard data scoping). |
| **Auth** | `lib/auth.ts`, `auth.ts` | NextAuth config, JWT session with roles/permissions. |

API routes are thin: auth → optional permission check → service call → response.

---

## Approval Engine Flow

When **approval policies** are enabled (Settings → Approval Policies), stock-affecting actions can require approval before execution.

1. **Request creation**  
   User performs an action (e.g. Receive purchase, Confirm sale, Adjust stock, Transfer). The API route calls `isApprovalRequired(prisma, entityType, context)`. If the policy is enabled (and optional conditions like `minAmount` or `warehouseScopeId` match), the route:
   - Creates the **entity** (e.g. `PurchaseReceiveRequest`, `Sale`, `StockAdjustment`, `StockTransfer`) with status **PENDING_APPROVAL**.
   - Creates an **ApprovalRequest** (status PENDING) linked via `entityId`.
   - Returns 202 with `pendingApproval: true`, `requestId`, `entityId`. **No** `StockService` call; no stock movements or balance changes.

2. **Approval**  
   A user with `approvals.review` calls `POST /api/approvals/:id/approve`. **ApprovalService.approveRequest**:
   - Ensures the request is PENDING; if already APPROVED, returns `{ executed: false }` (idempotent).
   - In a **single transaction**: updates the request to APPROVED (reviewer, reviewedAt, comment), then runs execution by `entityType`:
     - **PURCHASE_RECEIVE:** Loads `PurchaseReceiveRequest`, calls `StockService.receivePurchase` per item, sets status to RECEIVED, writes audit “execution completed.”
     - **SALE_CONFIRM:** Loads `Sale` and items, calls `StockService.confirmSale` per item, sets sale to CONFIRMED, audit.
     - **STOCK_ADJUSTMENT / STOCK_TRANSFER:** Loads entity, calls `StockService.adjustStock` or `transferStock`, sets status to APPLIED, audit.
   - Recomputes inventory metrics for affected (productId, warehouseId). Ledger and balances remain consistent (same as direct execution).

3. **Reject**  
   `POST /api/approvals/:id/reject` updates the request to REJECTED and the linked entity to REJECTED. No stock mutations.

4. **Cancel** (optional)  
   Requester or user with `approvals.manage` can cancel a PENDING request; request and entity set to CANCELLED (Sale → REJECTED). No stock mutations.

**Services:** `server/services/approvalService.ts` — `isApprovalRequired`, `requestApproval`, `approveRequest`, `rejectRequest`, `cancelRequest`. Execution always goes through `StockService`; integrity checks (ledger vs balances) pass after approval-based execution the same as after direct execution.

---

## Smart Reorder & Metrics Engine

- **Purpose:** Provide “days of cover,” “suggested reorder qty,” and “predicted stockout date” for each (product, warehouse) without recalculating on every dashboard or report load.
- **Data source:** Sales are derived from `stock_movements` where `movementType = 'OUT'` and `referenceType = 'SALE'`, filtered by an indexed `createdAt` range. Current stock is the sum of `stock_balances.quantity` for that (productId, warehouseId).
- **Service:** `server/services/inventoryMetricsService.ts` — `InventoryMetricsService.computeMetricsForProductWarehouse(productId, warehouseId, options)` runs three parallel queries (sales aggregate, balance sum, reorder policy), then computes and upserts into `inventory_metrics`. `recomputeAllMetrics(options)` processes all (productId, warehouseId) pairs in chunks with configurable concurrency.
- **When metrics are updated:** After `StockService.confirmSale`, `receivePurchase`, or `adjustStock`, the corresponding API routes call `recomputeForProductWarehouse(productId, warehouseId)` for affected pairs. Manual full recompute: `POST /api/reports/recompute-metrics` or “Recalculate” in Reports.
- **No full-table scan:** Queries use indexed filters (`productId`, `warehouseId`, `movementType`, `referenceType`, `createdAt` on `stock_movements`; `productId`, `warehouseId` on `stock_balances` and `inventory_metrics`). See PERFORMANCE_AUDIT.md for the composite index added for metrics sales aggregation.
