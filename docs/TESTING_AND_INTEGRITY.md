# Testing and Integrity

## Reusable verify-integrity logic

The integrity checks are implemented in **`lib/verify-integrity.ts`** as `runIntegrityChecks(prisma: PrismaClient)`. Use this in tests to assert ledger/balance consistency after stock operations. The CLI script `scripts/verify-integrity.ts` calls the same function.

---

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
- After approval-based execution (receive/confirm/adjust/transfer executed via Approvals): ledger and balances remain consistent; `runIntegrityChecks` passes the same as for direct execution.
- Periodically in production (e.g. cron) to detect integrity issues.

---

## Approval Integration Tests

**`test/approval.integration.test.ts`** covers the approval workflow:

- **PURCHASE_RECEIVE (policy enabled):** Receive creates approval_request and PurchaseReceiveRequest PENDING_APPROVAL; no stock_movements until approve; approve creates movements and RECEIVED; approving twice is idempotent (no double-apply).
- **SALE_CONFIRM (policy enabled):** Confirm creates request and Sale PENDING_APPROVAL; no OUT movement until approve; approve creates OUT movement and CONFIRMED.
- **Reject:** Reject sets entity REJECTED and no stock changes.
- **RBAC:** User without `approvals.review` gets 403 on approve/reject.
- **Integrity:** After approval execution, `runIntegrityChecks(prisma)` passes (ledger matches balances).

Run: `npx vitest run test/approval.integration.test.ts` (requires test DB).

---

## Integration Test Approach

Tests use **Vitest** and a **test database** (separate from dev). The test DB is reset between tests so each test starts from a clean state.

### Test DB strategy

- **URL:** Set `DATABASE_URL_TEST` to a dedicated PostgreSQL database (e.g. `inventory_test`). If unset, tests use `DATABASE_URL` (same as dev; avoid in CI).
- **Schema:** Use the same Prisma schema as dev. Run migrations on the test DB once:
  ```bash
  DATABASE_URL_TEST="postgresql://..." DIRECT_URL_TEST="postgresql://..." npx prisma migrate deploy
  ```
- **Setup:** `test/setup.ts` runs before tests: it loads `.env` and, when `DATABASE_URL_TEST` is set, overrides `DATABASE_URL` and `DIRECT_URL` so the app singleton (`lib/prisma`) and test helpers use the same test DB.

### DB reset between tests

- **Strategy:** Before each test, `resetTestDb(prisma)` deletes all data in FK-safe order (e.g. audit logs → movements → balances → users/roles → products/warehouses → settings). No schema drop/recreate; tables stay in place.
- **Helper:** `test/helpers/db.ts` exports `createTestPrisma()` (PrismaClient with test URL) and `resetTestDb(prisma)`.

### Factories (`test/helpers/factories.ts`)

| Factory | Purpose |
|--------|---------|
| `createUserWithPermissions(prisma, permissions[], options?)` | User with given permission keys (creates role + permissions if needed). |
| `createUserWithRole(prisma, roleName, permissions[], options?)` | User with a single role (upserts role with optional permissions). |
| `createWarehouse(prisma, name?)` | Active warehouse with unique code. |
| `createProduct(prisma, sku?)` | Active product with unique SKU. |
| `seedStock(prisma, { productId, warehouseId, quantity, userId, ... })` | One IN movement + balance update via `StockService.receivePurchase`. |
| `ensureSettings(prisma, allowNegativeStock?)` | Ensure global settings row exists (for integrity checks). |

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
npm run test              # watch mode (integration tests only)
npm run test:integration  # single run, CI-friendly
npm run test -- test/stock.integration.test.ts   # only stock tests
npm run test -- test/api/rbac.integration.test.ts # only RBAC API tests
```

**Scripts (package.json):**
- `test` — Vitest in watch mode; runs all `test/**/*.integration.test.ts`.
- `test:integration` — Vitest single run (no watch); same pattern.

**Typical CI flow:**
1. Set `DATABASE_URL_TEST` (and `DIRECT_URL_TEST` if using separate direct URL) to a dedicated test PostgreSQL database.
2. Run migrations on the test DB once: `DATABASE_URL_TEST=... DIRECT_URL_TEST=... npx prisma migrate deploy`.
3. Run `npm run test:integration`. Tests reset data between runs and do not depend on seed.
4. Optionally run `npm run verify:integrity` against the test DB after tests (tests already call `runIntegrityChecks` after stock mutations).

Do not run integration tests or verify-integrity against production.
