# Performance & Architecture Audit

**Date:** 2025 (audit run)  
**Scope:** Data flow, caching, correctness, query performance, RBAC, and stock mutation rules.

---

## 1. Current Findings (What Is Good)

### A) Architecture correctness

- **Route handlers are thin:** Stock adjust/transfer, dashboard, reports, and products APIs validate input, check auth/permission, then delegate to services. No business logic in route handlers.
- **Business logic in services:** `server/services/` (StockService, dashboardService, reportService, stockMovementService, settingsService, etc.) contain workflows and rules.
- **Prisma in repositories:** `server/repositories/` (stock.repository, dashboardRepo, reportRepo, stockMovementRepo, warehouse.repository) perform all DB access. Services call repos or Prisma via repos.
- **StockService as single mutator:** All stock changes (adjust, transfer, receivePurchase, confirmSale, increaseStock, decreaseStock) go through `StockService`; it uses `StockRepository` for balance updates and movement creation in a single transaction. No other code path was updating `stock_balances` except:
  - **Fixed:** `productImportService` previously wrote movements + balances directly; it now uses `StockService.increaseStock()` for opening stock (see Fixes below).
  - Seed and verify-integrity scripts are special-case (seed recomputes from ledger; verify only reads).

### B) Data model optimization

- **No recalculation on read:** Current stock is never derived by summing `stock_movements` on each request. All “current stock” reads use `stock_balances`.
- **stock_balances for current state:** Dashboard (total value, low stock), reports (inventory, stock value), warehouse/product pages, and product list low-stock filter use `stock_balances` (and product.stockBalances / joins).
- **stock_movements for history only:** Movement lists, trends, “today’s sales/purchases,” and report time-series use `stock_movements` with date/type filters.
- **Dashboard KPIs and reports:**
  - On-hand value / low stock: from `stock_balances` (+ product price/cost).
  - Trends (movement by day, sales vs purchases): from `stock_movements` with aggregation.
  - Sales/purchases totals: from `stock_movements` (IN/OUT) with date range; no separate sales/purchases tables.

### C) Query performance and indexes (Prisma schema)

- **stock_balances:** `@@unique([productId, warehouseId])`; `@@index([productId])`, `@@index([warehouseId])`, `@@index([available])`. Sufficient for lookups and low-stock filters.
- **stock_movements:** `@@index([warehouseId, createdAt])`, `@@index([productId, createdAt])`, `@@index([movementType, createdAt])`, plus single-column indexes on productId, warehouseId, movementType, createdAt, referenceNumber, createdById. Sufficient for list, filters, and report aggregations.
- **products:** `@@unique` on `sku`; indexes on sku, name, category, isActive.
- **audit_logs:** Indexes on userId, action, resource, resourceId, createdAt.

No separate “sales” or “purchases” tables; sales/purchases are represented by movements with `referenceType` and optional `referenceId`/`referenceNumber`. Existing indexes support current report queries. Optional future addition: `@@index([referenceType, createdAt])` on `stock_movements` if report filters by referenceType become heavy.

### D) Caching strategy (Next.js + client)

- **Data fetching:** All dynamic data is fetched via client `fetch()` to API routes (dashboard, products, stock movements, reports, users, roles, warehouses, settings, audit). No TanStack Query; no server component data fetching for these modules.
- **No accidental caching of dynamic data:** Dynamic API routes now use `export const dynamic = 'force-dynamic'` so responses are not cached by Next.js:
  - Dashboard: `app/api/dashboard/route.ts`
  - Stock: `app/api/stock/movements/route.ts`, `app/api/stock/movements/[id]/route.ts`, `app/api/stock/movements/export/route.ts`
  - Reports: `app/api/reports/overview/route.ts`, `inventory`, `movements`, `sales`, `purchases`, `audit`, `filters/route.ts`
  - Products: `app/api/products/route.ts`
- **UI refresh after mutations:** After adjust/transfer, the stock page calls `onSuccess()` which runs `fetchMovements()`, so the movements list and totals refetch. No revalidatePath is used (data is client-fetched); forcing dynamic on the API is sufficient so each refetch gets fresh data.

### E) TanStack Query

- **Not used.** The app uses raw `fetch` + `useState`/`useEffect`. No query keys or invalidation to maintain. If TanStack Query is introduced later, recommended pattern:
  - Query keys: e.g. `['products', { page, pageSize, search, filter }]`, `['stock-movements', { from, to, warehouseId, productId, type, page }]`, `['dashboard', range]`.
  - After adjust/transfer: invalidate `['stock-movements']`, `['dashboard']`, and any balance/movement queries for affected product/warehouse.
  - After product create/update/delete/import: invalidate `['products']`, `['dashboard']` if it depends on product counts.

### F) Reports/Dashboard aggregation

- **Dashboard:** Uses `dashboardRepo`: product/warehouse counts, total stock value (balances + product price), low stock count (balances), today’s sales/purchases (movement aggregates). No full-table scan; filters and indexes used.
- **Reports:** Use `reportRepo` and `reportService`: stock value and low stock from balances; sales/purchases and movement trends from movements with date range and optional warehouse/category. Pagination and limits applied on list endpoints.
- **Optimization:** No change required. If an endpoint becomes slow, add selective `select` fields, tighten `where` clauses, and consider `referenceType`+`createdAt` index on `stock_movements` for reference-type report filters.

---

## 2. Problems Found (with file paths)

| # | Issue | File(s) |
|---|--------|--------|
| 1 | **Stock balance mutated outside StockService** — Import opening stock created movement + balance via direct Prisma (upsert/increment), bypassing StockService. | `server/services/productImportService.ts` (applyOpeningStock + transaction block) |
| 2 | **Products API used new PrismaClient() per request** — Can exhaust connections; should use singleton. | `app/api/products/route.ts` |
| 3 | **Products API called prisma.$disconnect() in finally** — Singleton must not be disconnected per request. | `app/api/products/route.ts` |
| 4 | **Use of `any` in catch blocks** — Not strict TypeScript. | `app/api/products/route.ts` (catch (error: any)) |
| 5 | **Dynamic GET routes could be cached** — Dashboard and reports GET endpoints did not set `dynamic = 'force-dynamic'`, so Next.js might cache responses. | `app/api/dashboard/route.ts`, `app/api/reports/*/route.ts`, `app/api/products/route.ts` (GET) |

---

## 3. Fixes Applied (with file paths)

| # | Fix | File(s) |
|---|-----|--------|
| 1 | **Import opening stock via StockService** — Replaced direct `stockMovement.create` + `stockBalance.upsert` with `StockService.increaseStock()` in both `applyOpeningStock()` and the transaction path in `runImport()`. | `server/services/productImportService.ts` |
| 2 | **Use singleton Prisma** — Replaced `new PrismaClient()` with `import { prisma } from '@/lib/prisma'`. Removed `prisma.$disconnect()` from finally blocks. | `app/api/products/route.ts` |
| 3 | **Strict error typing** — Replaced `catch (error: any)` with `catch (error: unknown)` and proper narrowing (instanceof Error, code check). | `app/api/products/route.ts` |
| 4 | **Force dynamic for dynamic APIs** — Added `export const dynamic = 'force-dynamic'` so GET responses are not cached. | `app/api/dashboard/route.ts`, `app/api/products/route.ts`, `app/api/reports/overview/route.ts`, `app/api/reports/inventory/route.ts`, `app/api/reports/movements/route.ts`, `app/api/reports/sales/route.ts`, `app/api/reports/purchases/route.ts`, `app/api/reports/audit/route.ts`, `app/api/reports/filters/route.ts`, and report export routes: `reports/inventory/export`, `reports/movements/export`, `reports/sales/export`, `reports/purchases/export`, `reports/audit/export` |

---

## 4. Recommended Caching Strategy per Module

| Module | Strategy | Notes |
|--------|----------|--------|
| **Dashboard** | `dynamic = 'force-dynamic'` | Data changes after stock/report actions; no cache. |
| **Products** | `dynamic = 'force-dynamic'` | List and low-stock filter must stay fresh after create/update/import/delete. |
| **Stock movements** | Already `force-dynamic` | List and export must reflect new movements after adjust/transfer. |
| **Reports** | `dynamic = 'force-dynamic'` | All report endpoints depend on current balances and movements. |
| **Users / Roles / Warehouses / Settings / Audit** | Either `force-dynamic` or short revalidate (e.g. 0) | Prefer force-dynamic for consistency unless you add explicit revalidatePath after mutations. |

No `revalidatePath` was added because data is loaded client-side via fetch; forcing dynamic on the API ensures each refetch gets the latest data.

---

## 5. Query/Index Changes and Why

- **No schema migrations added.** Existing indexes are sufficient:
  - `stock_balances`: unique (productId, warehouseId); indexes support by-product, by-warehouse, and by-availability.
  - `stock_movements`: composite indexes (warehouseId+createdAt), (productId+createdAt), (movementType+createdAt) support list and report queries.
- **Optional future index:** If report filters often use `referenceType` (e.g. “sales only”, “purchases only”), add `@@index([referenceType, createdAt])` on `StockMovement` and create a migration.

---

## 6. Strict TypeScript (no `any`)

- **Products API:** Catch blocks updated from `error: any` to `error: unknown` with proper narrowing.
- **Optional:** If Prisma client types show errors for `costPrice` on Product in `productImportService`, run `npx prisma generate` to refresh generated types (schema already has `costPrice`).

---

## 7. Script: perf-check.ts

A small script `scripts/perf-check.ts` runs a few key queries and logs timings in dev. Run with:

```bash
npx tsx scripts/perf-check.ts
```

Requires `DATABASE_URL` in `.env`. Use only against a dev or test database.

---

## Summary

- **Architecture:** Thin routes, logic in services, data access in repositories; StockService is the only stock mutator after fixing product import.
- **Data model:** Balances for current state; movements for history; no recalculation on read.
- **Indexes:** Adequate; optional referenceType+createdAt if needed later.
- **Caching:** Dynamic APIs use `force-dynamic`; client refetches after mutations (e.g. fetchMovements after adjust/transfer).
- **TanStack Query:** Not used; recommendations documented for future use.
