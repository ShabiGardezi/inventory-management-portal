# Business Rules

These rules are enforced in code and must not be bypassed.

---

## Stock and Ledger

### 1. All stock updates via StockService

- **Rule:** Every change to on-hand quantity goes through `StockService` (increaseStock, decreaseStock, transferStock, adjustStock, receivePurchase, confirmSale).
- **No** direct updates to `stock_balances` from API or repositories outside `StockService` and the repository it uses inside a transaction.
- **No** direct inserts into `stock_movements` that are not part of a StockService operation.

### 2. Stock movements are immutable

- **Rule:** Rows in `stock_movements` are never updated or deleted by the application.
- New state is always expressed by **new** movement rows; balances are updated in the same transaction.
- Corrections are done by **adjustments** (new IN/OUT movements), not by editing past movements.

### 3. Transfer atomicity (2 movements)

- **Rule:** A transfer between two warehouses is exactly one transaction that:
  - Creates one **OUT** movement at the source warehouse.
  - Creates one **IN** movement at the destination warehouse.
  - Uses the **same** `referenceId` and same `referenceNumber` for both.
  - Same product, same quantity; then updates both balances.
- A transfer must never create only one movement or leave one side uncommitted.

### 4. Negative stock policy (allowNegativeStock)

- **Rule:** If global settings have `allowNegativeStock: false`, decrease and transfer operations must not allow the balance to go negative (StockService throws if result would be &lt; 0).
- If `allowNegativeStock: true`, negative balances are allowed for decreases/transfers.
- Adjust “set to exact” and decrease can optionally pass `allowNegative: true` per call (e.g. for write-offs); the service still respects the parameter.

### 5. Purchase receive triggers IN movements

- **Rule:** When a purchase is “received,” the only way to add stock is via:
  - `StockService.receivePurchase()`, or
  - `StockService.increaseStock()` with `referenceType: 'PURCHASE'` and optional referenceId/referenceNumber.
- Purchases do **not** affect stock until a receive action is performed.

### 6. Sale confirm triggers OUT movements

- **Rule:** When a sale is “confirmed” (or paid), the only way to reduce stock is via:
  - `StockService.confirmSale()`, or
  - `StockService.decreaseStock()` with `referenceType: 'SALE'` and optional referenceId/referenceNumber.
- Sales do **not** affect stock until a confirm action is performed. `confirmSale` respects `allowNegativeStock` unless overridden by the caller.

### 7. Batch tracking (trackBatches)

- **Rule:** When a product has `trackBatches: true`, every IN (receive, adjust increase, transfer IN) must supply either an existing `batchId` or `batchInput.batchNumber` (and optionally expiryDate, mfgDate). The system find-or-creates a batch per (productId, batchNumber).
- **Rule:** Every OUT (sale confirm, adjust decrease, transfer OUT) for a batch-tracked product must supply `batchId` so the correct balance (productId, warehouseId, batchId) is decreased.
- **Rule:** `stock_balances` has one row per (productId, warehouseId, batchId); `batchId` may be null for non-batch (legacy) balances. Movements carry `batchId` so ledger sums are per (productId, warehouseId, batchId).

### 8. Serial tracking (trackSerials)

- **Rule:** When a product has `trackSerials: true`, IN operations may optionally pass `serialNumbers: string[]`; each serial creates a `ProductSerial` row with status IN_STOCK, linked to warehouse and optional batch. Serial numbers are unique per product globally.
- **Rule:** OUT operations (sale confirm, transfer OUT, adjust decrease) for serial-tracked products **must** pass `serialNumbers` with length equal to quantity; the system marks those serials as SOLD (or DAMAGED/RETURNED per `serialDisposition`) and links them to the movement.
- **Rule:** Transfer of serial-tracked stock updates the serials’ `warehouseId` to the destination; the same serials remain IN_STOCK.

---

## Reorder & Metrics (Smart Reorder Engine)

- **Rule:** Reorder metrics (avg daily sales, days of cover, suggested reorder qty, predicted stockout date) are computed by `InventoryMetricsService` and stored in `inventory_metrics`. The dashboard and Reports **read** from this table; they do **not** recalculate from movements on each request.
- **Rule:** **Avg daily sales** = total quantity of OUT movements with `referenceType = 'SALE'` in the lookback window (configurable, default 30 days), divided by the number of days in that window. Only movements in the indexed `createdAt` range are summed; no full-table scan of `stock_movements`.
- **Rule:** **Days of cover** = current stock (sum of `stock_balances.quantity` for the product/warehouse) ÷ avg daily sales. If avg daily sales is 0, days of cover is 0 and predicted stockout date is not set.
- **Rule:** **Predicted stockout date** = now + (days of cover in days), when days of cover > 0.
- **Rule:** **Suggested reorder qty** = max(0, (leadTimeDays × avgDailySales + safetyStock) − currentStock). Lead time and safety stock come from `reorder_policies` for that (productId, warehouseId). If a `ReorderPolicy` has `maxStock` set, suggested reorder qty is capped so it does not exceed `maxStock`. If there is no reorder policy, suggested reorder qty is 0.
- **Rule:** Metrics are recomputed for affected (productId, warehouseId) **after** sale confirm, purchase receive, or stock adjust (via API route calling `recomputeForProductWarehouse`). A full recompute can be run manually (e.g. `POST /api/reports/recompute-metrics` or "Recalculate" in Reports) via `recomputeAllMetrics()`.

---

## Audit Logging

- **Rule:** The following must create an audit log entry (action, resource, resourceId, description, optional metadata):
  - Stock balance changes (increase, decrease, transfer, adjust) — done inside StockService/repository.
  - Sensitive user/role changes (e.g. role assign, user disable) — where implemented in the app.
  - Settings updates — where implemented.
- **Rule:** Audit metadata must **not** contain passwords, tokens, or API keys; sensitive keys are redacted before storing (see `auditService` redactMetadata).

---

## Approval Workflow

- **Rule:** When an **approval policy** is enabled for an entity type (PURCHASE_RECEIVE, SALE_CONFIRM, STOCK_ADJUSTMENT, STOCK_TRANSFER), the corresponding action (receive, confirm, adjust, transfer) **must not** execute stock mutations until an approval request is **approved** by a user with the reviewer permission (default `approvals.review`).
- **Rule:** On “Receive” / “Confirm” / “Adjust” / “Transfer” when policy is enabled: the system creates an **approval_request** (status PENDING) and the linked entity (e.g. PurchaseReceiveRequest, Sale, StockAdjustment, StockTransfer) is set to **PENDING_APPROVAL**. No `stock_movements` or balance updates occur at this step.
- **Rule:** Only when an approval request is **approved** does the system execute the underlying action (via `StockService`) in a single transaction: create movements, update balances, set entity status to RECEIVED/CONFIRMED/APPLIED, and write an audit log for “execution completed.” Execution is **idempotent**: approving an already-approved request does not run the action again.
- **Rule:** When an approval request is **rejected**, the request status is set to REJECTED and the linked entity status is set to REJECTED (or equivalent). No stock mutations occur.
- **Rule:** Cancellation (optional) is allowed for the requester or a user with `approvals.manage`; the request and entity are set to CANCELLED (Sale to REJECTED). No stock mutations.

### Status lifecycles (approval-related)

| Entity | Draft / Initial | After submit (policy on) | After approve | After reject |
|--------|------------------|---------------------------|---------------|--------------|
| **ApprovalRequest** | — | PENDING | APPROVED | REJECTED |
| **PurchaseReceiveRequest** | DRAFT | PENDING_APPROVAL | RECEIVED | REJECTED |
| **Sale** | DRAFT | PENDING_APPROVAL | CONFIRMED | REJECTED |
| **StockAdjustment** | DRAFT | PENDING_APPROVAL | APPLIED | REJECTED |
| **StockTransfer** | DRAFT | PENDING_APPROVAL | APPLIED | REJECTED |

---

## RBAC

- **Rule:** Access control is **permission-based**, not role-name-based.
  - Check `hasPermission(user, 'permission:key')` or `requirePermission('permission:key')` in API routes.
  - Services that scope data (e.g. dashboard) use the same permission/role checks.
- **Rule:** Do **not** branch logic on role name (e.g. “if role === 'admin'”) for feature access; use permissions so that custom roles can get the same access by having that permission assigned.

---

## Summary Table

| Rule | Enforced in |
|------|-------------|
| All stock updates via StockService | API routes call only StockService for stock changes |
| Movements immutable | No update/delete on stock_movements in app code |
| Transfer = 2 movements, same referenceId | StockService.transferStock |
| allowNegativeStock | StockService.decreaseStock / transferStock; settings read in service/callers |
| Purchase receive → IN only via service | receivePurchase / increaseStock(PURCHASE) |
| Sale confirm → OUT only via service | confirmSale / decreaseStock(SALE) |
| Batch tracking: IN with batchId/batchInput, OUT with batchId | StockService increaseStock / decreaseStock / transferStock; balances keyed by (productId, warehouseId, batchId) |
| Serial tracking: IN optional serialNumbers, OUT required serialNumbers | StockService; ProductSerial status and warehouseId updated |
| Reorder metrics: formula and when to recalc | InventoryMetricsService; API routes after confirm/receive/adjust; manual recompute endpoint |
| Audit for stock/sensitive actions | Stock repository + auditService; other services where applicable |
| Permission-based RBAC | lib/rbac + API + dashboard/report services |
| Approval: no stock until approved; idempotent execution; reject/cancel no stock | ApprovalService; API receive/confirm/adjust/transfer + approvals approve/reject |