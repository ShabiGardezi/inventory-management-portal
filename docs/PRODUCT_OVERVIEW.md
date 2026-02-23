# Product Overview

## Purpose and Target Users

The **Inventory Management Portal** is a business-ready inventory and stock management system for teams that need:

- **Multi-warehouse stock** with a clear audit trail
- **Role-based access** so staff, managers, and admins see only what they need
- **Accurate ledger** where every stock change is recorded and balances are derived from movements

**Target users:** Small to mid-size operations, warehouse staff, inventory clerks, managers, and administrators who need to track products, warehouses, stock movements, and reports without spreadsheets.

---

## Key Capabilities

- **RBAC (Role-Based Access Control)** — Admin, Manager, Staff, Viewer, and custom roles with permission-based UI and API
- **Immutable stock ledger** — `stock_movements` is append-only; `stock_balances` is derived and updated only via `StockService`
- **Atomic transfers** — One transfer creates two movements (OUT + IN) in a single transaction with a shared `referenceId`
- **Purchase receive** — Stock increases only when a purchase is “received” (IN movement with referenceType PURCHASE)
- **Sale confirm** — Stock decreases only when a sale is “confirmed” (OUT movement with referenceType SALE)
- **Adjustments** — Manual increase/decrease/set-to-exact via `StockService.adjustStock` (creates IN/OUT movements, never direct balance edits)
- **Audit logging** — Key actions (stock changes, role assignments, settings) logged with redaction of secrets
- **Dashboard and reports** — Role-scoped summaries, charts (Recharts), and export (CSV)

---

## Module Explanations (Navigation)

| Nav item | Purpose |
|-----|---------|
| **Dashboard** | Role-scoped summary cards, charts (movement trend, sales vs purchases, low stock by category, stock by category, my movements), and preview tables with “View all” links. Supports 7d / 30d / 90d and custom date range. |
| **Products** | Product catalog (SKU, name, category, unit, price, reorder level). List supports search and `?filter=low-stock`. Create, edit, view product details. |
| **Warehouses** | Warehouse master (code, name, address). Create, edit, view; warehouse-level stock and movements. |
| **Stock Movements** | Full list of IN/OUT/TRANSFER/ADJUSTMENT movements with filters (type, date range, warehouse, product, “my actions”). Adjust stock and transfer stock actions from here (permission-gated). |
| **Purchases** | Purchase/receiving context; receiving stock creates **IN** movements with referenceType PURCHASE via `StockService.receivePurchase`. |
| **Sales** | Sales context; confirming a sale creates **OUT** movements with referenceType SALE via `StockService.confirmSale` (or via approval execution when policies are enabled). |
| **Reports** | Overview, Inventory, Movements, Sales, Purchases, Audit tabs with filters (warehouse, category, range). Charts and tables; CSV export where permitted. |
| **Users** | User list and details; create/invite, edit, disable; assign roles. |
| **Roles** | Role list; create, edit, assign permissions; assign users to roles. Permission-based (no role-name checks in business logic). |
| **Audit Logs** | List of audit entries (action, resource, user, date) with filters. |
| **Settings** | Organization, inventory rules (e.g. allow negative stock, reorder alerts), notifications. Global settings scope (single-tenant). |
| **Approvals** | Review/approve/reject requests (purchase receive, sale confirm, stock adjust, transfer) when approval policies are enabled. Execution is idempotent and runs through `StockService`. |
| **Scan (top bar action)** | Barcode/QR lookup to quickly find a product/batch/serial by barcode/SKU/serial; designed for USB scanners or camera-based scanning. Visible when user has `inventory.read` / `inventory:read`. |

---

## Typical User Workflows

### Purchase → Receive

1. Purchase order is created externally or recorded (reference number).
2. When goods are **received**, the system creates an **IN** movement (referenceType PURCHASE, optional referenceId/referenceNumber) and updates the stock balance for that product/warehouse.
3. All receive flows go through `StockService.receivePurchase` (or `increaseStock` with referenceType PURCHASE).

```
[Purchase Order] --> Receive --> StockService.receivePurchase()
                                    --> 1 IN movement + balance update
```

### Sale → Confirm

1. Sale/order is recorded (reference number).
2. When the sale is **confirmed/paid**, the system creates an **OUT** movement (referenceType SALE) and decreases the balance.
3. All confirm flows go through `StockService.confirmSale`; `allowNegativeStock` from settings is respected unless overridden.

```
[Sale Order] --> Confirm --> StockService.confirmSale()
                                --> 1 OUT movement + balance update
```

### Transfer

1. User selects product, source warehouse, destination warehouse, quantity.
2. **One** transaction creates **two** movements: OUT at source, IN at destination, with the same `referenceId` and reference number.
3. Both balances are updated. Source cannot go negative unless `allowNegative` is true.

```
Transfer --> StockService.transferStock()
                --> OUT movement (from) + IN movement (to) + 2 balance updates
```

### Adjust

1. User selects product, warehouse, and method: increase, decrease, or set to exact quantity.
2. `StockService.adjustStock` creates one or more IN/OUT movements (referenceType ADJUSTMENT) and updates the balance. No direct balance editing.

---

## What Makes It “Business-Ready”

- **Single source of truth** — Stock state is derived from movements; integrity script verifies balances against the ledger.
- **Audit trail** — Every stock change is a movement row; audit logs for sensitive actions.
- **Permission-based access** — UI and API check permissions (e.g. `stock:adjust`, `audit:read`), not role names.
- **Configurable rules** — e.g. allow negative stock, reorder alerts, low stock threshold behavior (settings).
- **No secrets in docs or logs** — Passwords and tokens are redacted in audit metadata.
