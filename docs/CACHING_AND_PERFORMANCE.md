# Caching and Performance

This document describes the caching strategy, cache invalidation, and loading behavior used to keep the UI fast and data accurate.

## Goals

- **Instant shell**: Route-level `loading.tsx` shows skeletons immediately when navigating.
- **Fast data**: Short-lived server and browser caching where safe.
- **Accurate after mutations**: Cache invalidation after adjust/transfer/product create/update/delete/import.

## Loading UI (Step 1)

Route-level loading states ensure the shell appears immediately:

| Route | File | Content |
|-------|------|--------|
| Dashboard | `app/dashboard/loading.tsx` | Header, range buttons, stat cards, chart and table placeholders |
| Products | `app/dashboard/products/loading.tsx` | Title, actions, card with table skeleton (rows + pagination) |
| Reports | `app/dashboard/reports/loading.tsx` | Tabs, stat cards, chart block, table block |
| Stock | `app/dashboard/stock/loading.tsx` | Title, actions, filters, table skeleton + pagination |

Heavy sections (e.g. Products table) are already wrapped in `<Suspense>` where applicable so layout can render first.

## Caching Strategy (Step 2)

### Dashboard

- **GET `/api/dashboard`**
  - **Server**: `unstable_cache` with key `['dashboard', user.id, range, from, to]`, `revalidate: 15`, `tags: ['dashboard']`.
  - **Browser**: `Cache-Control: private, max-age=10, stale-while-revalidate=20`.
- **Invalidation**: After stock adjust or transfer, `revalidateTag('dashboard')` and `revalidateTag('stock-movements')` are called so the next dashboard request gets fresh data.

### Products

- **GET `/api/products`**
  - **Server**: `unstable_cache` with key from query params (page, limit, search, category, isActive, filter), `revalidate: 30`, `tags: ['products']`.
  - **Browser**: `Cache-Control: private, max-age=20, stale-while-revalidate=40`.
- **Invalidation**: After product create (POST), update (PATCH), delete (DELETE), bulk-delete, or import, `revalidateTag('products')` and `revalidateTag('dashboard')` are called.

### Reports

- **GET report data** (overview, inventory, sales, movements, purchases, audit)
  - **Browser**: `Cache-Control: private, max-age=15–20, stale-while-revalidate=30–40`. No server-side `unstable_cache` (reports are highly parameterized).
- **GET `/api/reports/filters`**
  - **Browser**: `Cache-Control: private, max-age=60, stale-while-revalidate=120` (filters change rarely).
- **Export routes** (e.g. `/api/reports/*/export`): Remain `force-dynamic`; no caching for one-off downloads.

### Stock movements (real-time)

- **GET `/api/stock/movements`**
  - **No caching**: `export const dynamic = 'force-dynamic'` so movements stay real-time after adjust/transfer.

### Roles / settings / permissions

- Not changed in this pass; can use longer `Cache-Control` (e.g. 60–300s) in a follow-up if needed.

## Where revalidateTag is called

| Mutation | Tags invalidated |
|----------|-------------------|
| Stock adjust (`POST /api/stock/adjust`) | `dashboard`, `stock-movements` |
| Stock transfer (`POST /api/stock/transfer`) | `dashboard`, `stock-movements` |
| Product create (`POST /api/products`) | `products`, `dashboard` |
| Product update (`PATCH /api/products/[id]`) | `products`, `dashboard` |
| Product delete (`DELETE /api/products/[id]`) | `products`, `dashboard` |
| Bulk delete (`POST /api/products/bulk-delete`) | `products`, `dashboard` |
| Product import (`POST /api/products/import`) | `products`, `dashboard` |

## Query and fetch behavior

- **Dashboard**: Single client fetch to `/api/dashboard`; no waterfall. Server uses `Promise.all` for dashboard data + format settings.
- **Products**: List is cached per (page, limit, search, category, isActive, low-stock filter). Low-stock filter uses `stock_balances` (no SUM over movements).
- **Reports**: Filters and tab data can be requested in parallel from the client where the UI allows.
- **Stock movements**: Paginated API; no caching so data stays accurate.

## Summary

- **loading.tsx** on dashboard, products, reports, and stock gives an instant skeleton on navigation.
- **Dashboard** and **products list** use `unstable_cache` plus short `Cache-Control` for faster repeat loads.
- **Reports** use only short `Cache-Control`; **stock movements** stay dynamic.
- **Mutations** call `revalidateTag()` so cached data is refreshed after changes without over-caching real-time flows.
