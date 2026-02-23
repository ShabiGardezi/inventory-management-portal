# Permissions Matrix

## Role List

| Role | Type | Description |
|------|------|-------------|
| **admin** | System | Full system access; all permissions. |
| **manager** | System | Inventory management: products, warehouses, stock, inventory, reports, purchase, sales, export, audit, users, roles, settings. |
| **staff** | System | Basic operations: product read/create; stock read/create/transfer. |
| **viewer** | System | Read-only: all resources with action `read` or `.read`. |
| **inventory_clerk** | Custom | Read-heavy; product and stock read (subset, up to 15 permissions). |
| **warehouse_lead** | Custom | Read-heavy; warehouse and stock (subset). |
| **procurement** | Custom | Read-heavy; purchase (subset). |
| **sales_rep** | Custom | Read-heavy; sales (subset). |
| **reports_only** | Custom | Reports module only (subset). |

---

## Permission Keys by Module

Permissions are stored by **name** (e.g. `product:read`). The app checks these names; both colon and dot forms exist for some (e.g. `audit:read` and `audit.read`).

### Products
- `product:create`, `product:read`, `product:update`, `product:delete`
- `inventory:read` — View inventory levels (used for Products tab and stock context)

### Warehouses
- `warehouse:create`, `warehouse:read`, `warehouse:update`, `warehouse:delete`
- `warehouse.read` — View warehouses (reports filter)

### Stock
- `stock:create`, `stock:read`, `stock:update`, `stock:delete`
- `stock:transfer` — Transfer between warehouses
- `stock:adjust` — Adjust quantities (increase/decrease/set)

### Users
- `user:create`, `user:read`, `user:update`, `user:delete`
- `users.read`, `users.create`, `users.update`, `users.disable`

### Roles
- `role:create`, `role:read`, `role:update`, `role:delete`, `role:assign`
- `roles.read`, `roles.assign`, `roles.manage` — Manage roles and permissions

### Audit
- `audit:read`, `audit.read` — View audit logs

### Approvals
- `approvals.read` — View approval requests (list and detail)
- `approvals.review` — Approve or reject approval requests (required to execute pending receive/confirm/adjust/transfer)
- `approvals.manage` — Manage approval policies (Settings → Approval Policies) and cancel any request

### Settings
- `settings.read`, `settings.update`

### Reports
- `reports:read`, `reports.read` — View reports
- `inventory.read` — View inventory (reports)
- `purchase.read` — View purchase reports
- `sales.read` — View sales reports
- `export.read` — Export reports to CSV

### Scan (barcode/QR lookup)

- **UI**: Scan is a **top navbar button/modal**, not a sidebar tab.
- **Permission gate**: visible when user has `inventory.read` or `inventory:read` (same as Inventory read).

---

## Default Role–Permission Matrix

A **✓** means the role has that permission by default (from seed). Empty = no.

| Permission | Admin | Manager | Staff | Viewer |
|------------|:-----:|:-------:|:-----:|:------:|
| product:* | ✓ | ✓ | create, read only | read |
| warehouse:* | ✓ | ✓ | — | read |
| stock:* | ✓ | ✓ | read, create, transfer | read |
| stock:adjust | ✓ | ✓ | — | — |
| approvals.read | ✓ | ✓ | — | ✓ |
| approvals.review | ✓ | ✓ | — | — |
| approvals.manage | ✓ | ✓ | — | — |
| user:* / users.* | ✓ | ✓ | — | read |
| role:* / roles.* | ✓ | ✓ | — | read |
| audit.read / audit:read | ✓ | ✓ | — | ✓ |
| settings.* | ✓ | ✓ | — | read |
| inventory:read / inventory.read | ✓ | ✓ | — | ✓ |
| reports.read / reports:read | ✓ | ✓ | — | ✓ |
| purchase.read | ✓ | ✓ | — | ✓ |
| sales.read | ✓ | ✓ | — | ✓ |
| export.read | ✓ | ✓ | — | ✓ |

**Custom roles** (inventory_clerk, warehouse_lead, procurement, sales_rep, reports_only) get a **subset** of permissions (read-heavy, up to 15 per role) as defined in the seed; exact list is in `prisma/seed/generators/rolesPermissions.ts`.

---

## Sidebar Visibility Logic

The sidebar uses **required permissions per nav item**. A nav item is shown if the user has **at least one** of the required permissions for that item.

| Tab | Required permissions (any one) |
|-----|---------------------------------|
| Dashboard | *(none — always visible after login)* |
| Products | `product:read`, `inventory:read` |
| Warehouses | `warehouse:read` |
| Stock Movements | `inventory:read`, `stock:read` |
| Approvals | `approvals.read`, `approvals.review` |
| Purchases | `purchase:read`, `purchase.read` |
| Sales | `sales:read`, `sales.read` |
| Reports | `reports.read`, `reports:read` |
| Users | `users.read`, `user:read` |
| Roles | `roles.manage`, `roles.read` |
| Audit Logs | `audit.read`, `audit:read` |
| Settings | `settings.read` |

**Scan button (top bar):** `inventory.read`, `inventory:read`

- **Empty** `requiredPermissions` (Dashboard) → item is always visible to any logged-in user.
- Nested routes (e.g. `/dashboard/products/[id]`) use the same requirement as the parent path (e.g. `/dashboard/products`).
- API routes enforce the same permissions via `requirePermission()` or equivalent; sidebar only controls visibility, not security.
