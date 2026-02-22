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
- **Audit trail** — Movements and audit logs for key actions; sensitive fields redacted.
- **Dashboard and reports** — Role-scoped summaries, charts, and CSV export.

---

## Module List (11 Tabs)

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

Add any NextAuth/oauth vars if you use social login; see app auth config. **Do not commit secrets.**

### 4. Database

```bash
# Create DB if needed (e.g. createdb inventory_db)
npm run db:migrate
npm run db:seed
```

Migrate creates tables and generates Prisma Client; seed creates default roles, permissions, test users, sample warehouses/products, and initial stock.

### 5. Test Users (after seed)

- **Admin:** `admin@example.com` / `password123`
- **Manager:** `manager@example.com` / `password123`
- **Staff:** `staff@example.com` / `password123`
- **Viewer:** `viewer@example.com` / `password123`

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
| [Database Schema](docs/DATABASE_SCHEMA.md) | Tables (users, roles, permissions, products, warehouses, stock_movements, stock_balances, settings, audit_logs), constraints, example queries. No separate Purchase/Sale tables — purchases/sales are movements with referenceType. |
| [Business Rules](docs/BUSINESS_RULES.md) | StockService-only updates, immutable movements, transfer atomicity, allowNegativeStock, receive/confirm rules, audit and RBAC. |
| [Permissions Matrix](docs/PERMISSIONS_MATRIX.md) | Roles, permission keys by module, default role–permission matrix, sidebar visibility. |
| [Testing and Integrity](docs/TESTING_AND_INTEGRITY.md) | What `verify:integrity` checks, integration test approach, scenarios (adjust, transfer, purchase receive, sale confirm, RBAC 403), how to run. |

---

## Next Steps

1. Set `DATABASE_URL` in `.env`
2. Run `npm run db:migrate` and `npm run db:seed`
3. Run `npm run dev` and sign in with a test user
4. Use the docs above to understand modules, data flow, and business rules
