# Database Reset and Full Seed (Phase 0–5)

Production-safe CLI scripts for resetting and seeding the Inventory Management System. **Designed to be extremely hard to run accidentally.**

---

## Required environment variables

All of the following must be set **exactly** (case-sensitive):

| Variable | Required value |
|----------|----------------|
| `ALLOW_DB_RESET` | `YES_DELETE_ALL` |
| `CONFIRM_RESET_TEXT` | `DELETE_DATABASE_NOW` |
| `BACKUP_CONFIRMED` | `YES` |

If `NODE_ENV === "production"`, you must also set:

| Variable | Required value |
|----------|----------------|
| `ALLOW_PROD_RESET` | `I_UNDERSTAND_THIS_IS_DESTRUCTIVE` |

---

## Database lockdown gate

Before any reset or seed, the scripts check **Settings** (GLOBAL scope):

- **`Settings.systemLockdown`** must be `true`, **or**
- **`Settings.allowProdWipe`** must be `true`

If there is no GLOBAL Settings row (e.g. brand‑new DB), **db-seed** may still run (it will create Settings with `systemLockdown=true`). **db-reset** always requires an existing Settings row with one of these flags set.

**Recommendation:** Set both to `true` when you intend to allow reset/seed, then set `systemLockdown=false` after go‑live if you no longer want to allow resets.

---

## Human verification

When you run **db-reset** or **db-seed**, the script will:

1. Print the database name and host from `DATABASE_URL`.
2. Ask you to type the **exact database name** to proceed.
3. Refuse to continue if the typed name does not match.

Use this to avoid pointing at the wrong database. To skip this prompt (e.g. in CI), pass `--yes` (use with extreme care).

---

## Production “empty usage” gate

When `NODE_ENV === "production"`:

- Scripts refuse to run unless **non-admin user count is 0** (or at most one admin), **or**
- **`Settings.allowProdWipe`** is `true`.

This reduces the risk of wiping a production database that already has real users.

---

## Scripts

| Script | Purpose |
|--------|--------|
| **db:reset** | Run safety gates, then truncate all application tables (FK-safe with CASCADE). |
| **db:seed:full** | Run safety gates, then run the full Phase 0–5 seed. |
| **db:refresh** | Run **db:reset** then **db:seed:full** (same gates; you will be prompted for verification for each step unless `--yes`). |

### Commands

```bash
# Reset only (requires typing DB name when prompted)
ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:reset

# Full seed only
ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:seed:full

# Reset + seed (recommended for a clean slate)
ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:refresh
```

### Skip human verification (use with care)

```bash
ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:refresh -- --yes
```

---

## Seed scale and options

| Env | Values | Default |
|-----|--------|--------|
| **SEED_SCALE** | `small`, `medium`, `large` | `small` |
| **SEED_KEY** | Any string | `default` (used for deterministic RNG) |
| **VALUATION_METHOD** | `FIFO`, `AVERAGE_COST` | `AVERAGE_COST` |
| **ENABLE_APPROVALS** | `true` / (anything else) | off |
| **DISABLE_LOCKDOWN_AFTER_SEED** | `true` to set `systemLockdown=false` after seed | off (lockdown stays on) |

### Scale presets

- **small:** 2 warehouses, 40 products, 10 purchases, 15 sales, 5 transfers, 4 adjustments.
- **medium:** 5 warehouses, 200 products, 60 purchases, 80 sales, 25 transfers, 20 adjustments.
- **large:** 10 warehouses, 800 products, 250 purchases, 300 sales, 80 transfers, 50 adjustments.

### Examples

```bash
# Small deterministic seed
SEED_SCALE=small SEED_KEY=mykey123 ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:seed:full

# Medium with approvals and FIFO
SEED_SCALE=medium VALUATION_METHOD=FIFO ENABLE_APPROVALS=true ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:seed:full

# Large seed, then turn off lockdown
SEED_SCALE=large DISABLE_LOCKDOWN_AFTER_SEED=true ALLOW_DB_RESET=YES_DELETE_ALL CONFIRM_RESET_TEXT=DELETE_DATABASE_NOW BACKUP_CONFIRMED=YES npm run db:seed:full
```

---

## Lockdown steps (before first reset/seed on a new DB)

1. Run migrations: `npm run db:migrate` (or `db:push` if you prefer).
2. Ensure the **Settings** table has a GLOBAL row. If it does not, run **db:seed:full** once; it will create Settings with `systemLockdown=true`. For a completely empty DB, the seed script is allowed to run without an existing Settings row (it creates one first).
3. For **db-reset**, you must have already run seed (or otherwise created a GLOBAL Settings row with `systemLockdown=true` or `allowProdWipe=true`).

---

## What the full seed creates

- **Phase 0:** Settings, roles, permissions, users (admin@local, manager@local, staff1@local, staff2@local, viewer@local), warehouses, products (normal + batch + serial + barcodes).
- **Phase 1:** Batches and serials are created via **purchase receive** (StockService), not inserted directly.
- **Phase 2:** Purchases received via **StockService.receivePurchase**; sales confirmed via **StockService.confirmSale** (IN/OUT movements, balances; inventory layers/COGS depend on your valuation implementation).
- **Phase 3:** Reorder policies and **InventoryMetricsService.recomputeAllMetrics()**.
- **Phase 4:** Approval policies; if **ENABLE_APPROVALS=true**, sample pending/approved/rejected requests.
- **Phase 5:** Product barcodes and sample scan codes printed at the end.

All stock changes go through **StockService** (no direct writes to `stock_balances` or `stock_movements`). After seed, **verify-integrity** is run automatically.

---

## Default logins (after seed)

Password for all: **password123**

- **admin@local** – Admin  
- **manager@local** – Manager  
- **staff1@local**, **staff2@local** – Staff  
- **viewer@local** – Viewer  

---

## Production usage warning

- Resetting or re-seeding **destroys all data** in the application tables.
- Use **db:reset** / **db:seed:full** / **db:refresh** against production only when you explicitly intend to wipe and repopulate (e.g. pre–go-live).
- Always ensure backups and required env vars (including **ALLOW_PROD_RESET** in production) and that **Settings.systemLockdown** or **Settings.allowProdWipe** is set as intended before running these scripts.
