# Inventory Management Portal

An **RBAC inventory management system** for teams that need multi-warehouse stock, a clear audit trail, and role-based access. Built with Next.js 15, TypeScript, PostgreSQL, Prisma, and NextAuth (JWT).

---

## What It Is and Who It’s For

- **What:** Web app to manage products, warehouses, stock movements, and reports with permission-based UI and API.
- **Who:** Small to mid-size operations, warehouse staff, inventory clerks, managers, and admins who need accurate stock levels and traceability without spreadsheets.

---

## Quick Features

- **Role-based access** — Admin, Manager, Staff, Viewer, and custom roles; permission-based tabs and API.
- **Immutable stock ledger** — All changes go through `StockService`; balances derived from movements; no direct balance edits.
- **Atomic transfers** — One transfer = two movements (OUT + IN) in one transaction, same `referenceId`.
- **Purchase receive / Sale confirm** — Stock changes only when you receive a purchase (IN) or confirm a sale (OUT).
- **Approval workflow (Phase 4)** — Optional approval policies; requests are PENDING until reviewed, then executed idempotently.
- **Audit trail** — Movements and audit logs for key actions; sensitive fields redacted.
- **Dashboard and reports** — Role-scoped summaries, charts, and CSV export.
- **Barcode/scan lookup (Phase 5)** — Barcode-enabled products and scan lookup endpoint for fast retrieval.

---

## Module List (12 Sidebar Tabs + Scan action)

| Module | Purpose |
|--------|---------|
| **Dashboard** | Summary cards, movement/sales/purchase charts, low stock, “my movements.” |
| **Products** | Catalog (SKU, category, reorder level); create, edit, view. |
| **Warehouses** | Warehouse master; create, edit, view; stock by warehouse. |
| **Stock Movements** | List and filter movements; adjust and transfer (permission-gated). |
| **Purchases** | Purchase context; receive flow creates IN movements (PURCHASE). |
| **Sales** | Sales context; confirm flow creates OUT movements (SALE). |
| **Reports** | Overview, Inventory, Movements, Sales, Purchases, Audit; filters and export. |
| **Users** | User list, create/edit, disable, assign roles. |
| **Roles** | Role list, create/edit, assign permissions and users. |
| **Audit Logs** | List audit entries with filters. |
| **Settings** | Organization and inventory rules (e.g. allow negative stock). |
| **Approvals** | Approval queue and policy management (permission-gated). |
| **Scan (Top bar)** | Barcode/QR lookup (manual/USB scanner/camera workflows). |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth (JWT strategy)
- **RBAC:** Permission-based (no role-name checks in business logic)

---

## Local Setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn

### 2. Install

```bash
npm install
```

### 3. Environment

Create `.env` with at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

Example for local PostgreSQL:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventory_db?schema=public"
```

For **Supabase** use two URLs (pooler for the app, direct for migrations). Replace `[YOUR-PASSWORD]` with your database password from Supabase → Project Settings → Database:

```env
# App connections (pooler, port 6543)
DATABASE_URL="postgresql://postgres.imhdlyufggostpiosoqf:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1"

# Direct (preferred for migrations / schema pushes, port 5432)
DIRECT_URL="postgresql://postgres.[ref]:[YOUR-PASSWORD]@db.[ref].supabase.co:5432/postgres?sslmode=require"
```

If your Supabase **Direct connection** shows "Not IPv4 compatible", use the **Session pooler** (same pooler host, port 5432) for `DIRECT_URL` instead.

For **local PostgreSQL only**, set `DIRECT_URL` to the same value as `DATABASE_URL`. Prisma CLI reads `.env` in the project root (not `.env.local`), so put `DATABASE_URL` and `DIRECT_URL` in `.env` for `db:migrate` to work.

Add any NextAuth/oauth vars if you use social login; see app auth config. **Do not commit secrets.**

### 4. Database

```bash
# Create DB if needed (e.g. createdb inventory_db)
npm run db:migrate
npm run db:seed         # lightweight seed (Prisma seed)
npm run db:seed:full    # full Phase 0–5 seed (recommended; see docs/DB_RESET_AND_SEED.md)
```

Migrate creates tables and generates Prisma Client. `db:seed` provides a lightweight baseline; `db:seed:full` creates Phase 0–5 demo data (RBAC, warehouses, products, stock, approvals, reorder/metrics, and reporting fixtures).

### 5. Test Users (after seed)

The login page shows the current demo accounts. Password for all: `password123`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run migrations (dev) |
| `npm run db:seed` | Seed database |
| `npm run db:seed:reset` | Reset and seed |
| `npm run db:reset` | Production-safe truncate reset (hard safety gates) |
| `npm run db:seed:full` | Production-safe full Phase 0–5 seed (hard safety gates) |
| `npm run db:refresh` | Production-safe reset + seed |
| `npm run db:seed:roles-users` | Seed permissions + roles + role users (no wipe) |
| `npm run db:seed:users` | Upsert role users only (no wipe) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:push` | Push schema without migrations |
| `npm run verify:integrity` | Verify stock ledger vs balances and transfer rules |
| `npm run test` | Run tests (Vitest) |
| `npm run test:integration` | Run integration tests (Vitest run) |
| `npm run lint` | Run lint |

---

## Documentation (High-Level Architecture)

Detailed docs live in the `docs/` folder:

| Document | Contents |
|----------|----------|
| [Product Overview](docs/PRODUCT_OVERVIEW.md) | Purpose, users, capabilities, modules, workflows (purchase→receive, sale→confirm, transfer, adjust). |
| [Architecture](docs/ARCHITECTURE.md) | Next.js FE+BE, services/repos, data flow, stock engine (ledger + balances), caching/refetch, where logic lives. |
| [Database Schema](docs/DATABASE_SCHEMA.md) | Tables (RBAC, inventory, approvals, sales, settings, audit), constraints, and example queries. Purchases are movements + requests; sales are stored in Sale/SaleItem and also reflected in movements. |
| [Business Rules](docs/BUSINESS_RULES.md) | StockService-only updates, immutable movements, transfer atomicity, allowNegativeStock, receive/confirm rules, audit and RBAC. |
| [Permissions Matrix](docs/PERMISSIONS_MATRIX.md) | Roles, permission keys by module, default role–permission matrix, sidebar visibility. |
| [Testing and Integrity](docs/TESTING_AND_INTEGRITY.md) | What `verify:integrity` checks, integration test approach, scenarios (adjust, transfer, purchase receive, sale confirm, RBAC 403), how to run. |
| [DB Reset & Seed](docs/DB_RESET_AND_SEED.md) | Production-safe db-reset/db-seed/db-refresh with hard safety gates (Phase 0–5 seed). |
| [Vercel Env Checklist](docs/VERCEL_ENV_CHECKLIST.md) | What to set on Vercel when local works but prod fails. |
| [Vercel + Supabase](docs/VERCEL_SUPABASE.md) | Deployment notes and DB connection strings for Vercel/Supabase. |
| [Activate / Seed Users](docs/ACTIVATE_USER.md) | Quick commands to seed permissions/roles/users on an existing DB. |

---

## Production Health Check

- `GET /api/health/db` returns `{ ok: true }` when the database is reachable. Useful on Vercel deployments.

---

## Next Steps

1. Set `DATABASE_URL` in `.env`
2. Run `npm run db:migrate` and `npm run db:seed`
3. Run `npm run dev` and sign in with a test user
4. Use the docs above to understand modules, data flow, and business rules
