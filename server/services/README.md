# Stock Service

The StockService provides methods for managing stock operations with full transaction support, audit logging, and negative stock prevention.

## Usage

```typescript
import { PrismaClient } from '@prisma/client';
import { StockService } from './stock.service';

const prisma = new PrismaClient();
const stockService = new StockService(prisma);

// Increase stock
const increaseResult = await stockService.increaseStock({
  productId: 'product-id',
  warehouseId: 'warehouse-id',
  quantity: 100,
  createdById: 'user-id',
  referenceNumber: 'PO-12345',
  notes: 'Purchase order delivery',
});

// Decrease stock (prevents negative stock by default)
const decreaseResult = await stockService.decreaseStock({
  productId: 'product-id',
  warehouseId: 'warehouse-id',
  quantity: 50,
  createdById: 'user-id',
  referenceNumber: 'SO-67890',
  notes: 'Sale order fulfillment',
  allowNegative: false, // Default: false
});

// Transfer stock between warehouses
const transferResult = await stockService.transferStock({
  productId: 'product-id',
  fromWarehouseId: 'warehouse-1-id',
  toWarehouseId: 'warehouse-2-id',
  quantity: 25,
  createdById: 'user-id',
  referenceNumber: 'TRANSFER-001',
  notes: 'Stock reallocation',
  allowNegative: false, // Default: false
});
```

## Features

- **Transaction Support**: All operations use Prisma transactions for atomicity
- **Stock Movement Tracking**: Every operation creates a record in `stock_movements`
- **Balance Updates**: Automatically updates `stock_balances` table
- **Negative Stock Prevention**: Prevents negative stock unless explicitly allowed
- **Audit Logging**: All operations are logged in `audit_logs` with metadata
- **Validation**: Verifies product and warehouse existence before operations
- **Error Handling**: Comprehensive error messages for all failure scenarios

## Methods

### `increaseStock(params)`
Increases stock quantity in a warehouse.

**Parameters:**
- `productId`: Product ID
- `warehouseId`: Warehouse ID
- `quantity`: Amount to increase (must be > 0)
- `createdById`: Optional user ID who performed the action
- `referenceNumber`: Optional reference number (PO, invoice, etc.)
- `notes`: Optional notes

**Returns:** `StockOperationResult` with updated balance and movement record

### `decreaseStock(params)`
Decreases stock quantity in a warehouse.

**Parameters:**
- `productId`: Product ID
- `warehouseId`: Warehouse ID
- `quantity`: Amount to decrease (must be > 0)
- `createdById`: Optional user ID who performed the action
- `referenceNumber`: Optional reference number (SO, invoice, etc.)
- `notes`: Optional notes
- `allowNegative`: Allow negative stock (default: false)

**Returns:** `StockOperationResult` with updated balance and movement record

**Throws:** Error if insufficient stock and `allowNegative` is false

### `transferStock(params)`
Transfers stock between two warehouses.

**Parameters:**
- `productId`: Product ID
- `fromWarehouseId`: Source warehouse ID
- `toWarehouseId`: Destination warehouse ID
- `quantity`: Amount to transfer (must be > 0)
- `createdById`: Optional user ID who performed the action
- `referenceNumber`: Optional reference number
- `notes`: Optional notes
- `allowNegative`: Allow negative stock in source (default: false)

**Returns:** `TransferStockResult` with updated balances for both warehouses and movement record

**Throws:** Error if:
- Source and destination are the same
- Insufficient stock in source and `allowNegative` is false

## Architecture

- **Service Layer** (`stock.service.ts`): Business logic and orchestration
- **Repository Layer** (`stock.repository.ts`): Data access abstraction
- **Types** (`stock.types.ts`): TypeScript interfaces and types

All operations are atomic and include:
1. Validation of inputs and entities
2. Stock balance updates
3. Stock movement records
4. Audit log entries
