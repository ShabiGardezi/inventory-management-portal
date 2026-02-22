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

---

## Audit Logging

- **Rule:** The following must create an audit log entry (action, resource, resourceId, description, optional metadata):
  - Stock balance changes (increase, decrease, transfer, adjust) — done inside StockService/repository.
  - Sensitive user/role changes (e.g. role assign, user disable) — where implemented in the app.
  - Settings updates — where implemented.
- **Rule:** Audit metadata must **not** contain passwords, tokens, or API keys; sensitive keys are redacted before storing (see `auditService` redactMetadata).

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
| Audit for stock/sensitive actions | Stock repository + auditService; other services where applicable |
| Permission-based RBAC | lib/rbac + API + dashboard/report services |
