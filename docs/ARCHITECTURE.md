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
- **Reports** — `GET /api/reports/*` (overview, inventory, movements, sales, purchases, audit) → `reportService` / `reportRepo`; filters by warehouse, category, date range; export uses same data.
- **Users / Roles** — APIs use `userService`, `roleService`; permissions loaded with user session (NextAuth callbacks).
- **Audit** — `createAuditLog()` called from services (e.g. stock operations); list via `GET /api/audit` with permission `audit:read`.

---

## Stock Engine Design

### Balances and Movements (Ledger)

- **`stock_movements`** — Immutable ledger. Every change is an append-only row: IN, OUT, TRANSFER, ADJUSTMENT; optional referenceType (PURCHASE, SALE, TRANSFER, ADJUSTMENT, MANUAL) and referenceId/referenceNumber.
- **`stock_balances`** — Current state per (productId, warehouseId): quantity, reserved, available. Updated **only** inside `StockService` when creating movements (never direct SQL updates from outside).

Conceptually:

```
  SUM(movements IN - OUT) per (product, warehouse)  ===  stock_balance.quantity
```

The **verify-integrity** script checks this; transfer pairs (same referenceId, one IN + one OUT, same quantity) are also validated.

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
