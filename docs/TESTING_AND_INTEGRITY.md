# Testing and Integrity

## verify-integrity Script

The **verify-integrity** script checks that the stock ledger and balances are consistent and that business rules are respected. Run it after migrations, seeds, or data changes to catch drift or bugs.

**Run:** `npm run verify:integrity` (or `tsx scripts/verify-integrity.ts`)

**Exit code:** 0 = all checks passed; 1 = one or more failures (errors printed to stderr).

---

### What It Checks

1. **Balance = sum of movements (per product/warehouse)**  
   For each `(productId, warehouseId)`:
   - Sum of signed movement quantities (IN = +quantity, OUT = -quantity) is computed from `stock_movements`.
   - This sum must equal `stock_balances.quantity` within a small decimal tolerance (0.001).
   - If not, you get: `Balance mismatch (productId=..., warehouseId=...): stock_balance.quantity=X != SUM(movements)=Y`.

2. **Transfer pairs**  
   Every movement with `referenceType = 'TRANSFER'` is grouped by `referenceId`:
   - Each group must have **exactly 2** movements: **one IN** and **one OUT**.
   - Both must have the **same quantity** and **same productId**.
   - Legacy pairs (referenceId pointing to another movement id) are also accepted when they form a valid IN/OUT pair.
   - Otherwise: `Transfer referenceId=...: expected exactly 2 movements (or legacy pair), got N`.

3. **Negative balances (when allowNegativeStock is false)**  
   If global settings have `allowNegativeStock: false`:
   - No `stock_balances.quantity` may be negative (within tolerance).
   - Otherwise: `Negative balance (productId=..., warehouseId=...): quantity=X but allowNegativeStock=false`.

---

### When to Run

- After `db:seed` or any script that creates/updates stock.
- In CI after integration tests that mutate stock.
- Periodically in production (e.g. cron) to detect integrity issues.

---

## Integration Test Approach

Tests use **Vitest** and a **test database** (separate from dev). The test DB is reset (or migrated) so tests don’t depend on dev data.

- **Test DB:** Use a dedicated database (e.g. `DATABASE_URL` pointing to `inventory_test` or `postgres` with a test schema).
- **Reset:** Before or during tests, schema is applied and data is cleared (or seed is run) so each test starts from a known state.
- **Factories:** Helpers create users, products, warehouses, and users with specific permissions (e.g. `createUserWithPermissions(prisma, ['stock:read'])`).

---

## Required Scenarios (Covered in Tests)

The integration suite should (and in the codebase does) cover:

1. **Adjust**  
   - Call `StockService.adjustStock` (e.g. increase).  
   - Assert: one ADJUSTMENT movement is created, balance is updated correctly.  
   - Run `runIntegrityChecks(prisma)` and assert no errors.

2. **Transfer**  
   - Call `StockService.transferStock` (product, from warehouse, to warehouse, quantity).  
   - Assert: exactly 2 movements with same `referenceId`, one IN and one OUT, same quantity and productId; both balances updated.  
   - Run integrity checks and assert they pass.

3. **Purchase receive**  
   - Call `StockService.receivePurchase` (product, warehouse, quantity, referenceNumber/referenceId).  
   - Assert: one IN movement with referenceType PURCHASE; balance increased; integrity checks pass.

4. **Sale confirm**  
   - Seed stock (e.g. receivePurchase), then call `StockService.confirmSale`.  
   - Assert: one OUT movement with referenceType SALE; balance decreased; integrity checks pass.

5. **RBAC 403**  
   - Call an API that requires a permission the user does not have (e.g. stock:adjust).  
   - Assert: response is 403 (or equivalent “permission denied”).

---

## How to Run Tests and Integrity Checks

**Integrity only (no tests):**
```bash
npm run verify:integrity
```

**Integration tests (Vitest):**
```bash
npm run test
# or, if you have a test script that targets integration tests:
npm run test -- test/stock.integration.test.ts
```

**Typical CI flow:**
1. Start or use a test PostgreSQL instance.
2. Set `DATABASE_URL` to the test DB.
3. `npm run db:migrate` (or `db:push`) on test DB.
4. `npm run test` (runs integration tests that use the test DB).
5. `npm run verify:integrity` (optional; tests already run it after stock mutations).

Ensure `.env.test` or CI env provides a test `DATABASE_URL`; do not run integrity or tests against production without a dedicated test database.
