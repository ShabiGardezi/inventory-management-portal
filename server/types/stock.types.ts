import { Decimal } from '@prisma/client/runtime/library';

export type StockReferenceType = 'PURCHASE' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'MANUAL';

/** For batch-tracked IN: provide batchId (existing) or batchNumber to find-or-create. */
export interface BatchInput {
  batchId?: string | null;
  batchNumber?: string;
  mfgDate?: Date | null;
  expiryDate?: Date | null;
  notes?: string | null;
}

export type SerialDisposition = 'SOLD' | 'DAMAGED' | 'RETURNED';

export interface IncreaseStockParams {
  productId: string;
  warehouseId: string;
  quantity: number | Decimal;
  createdById?: string;
  referenceType?: StockReferenceType | null;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
  /** When product.trackBatches: required (batchId or batchInput.batchNumber). */
  batchId?: string | null;
  batchInput?: BatchInput | null;
  /** When product.trackSerials: optional on IN; creates ProductSerial IN_STOCK. */
  serialNumbers?: string[] | null;
}

export interface DecreaseStockParams {
  productId: string;
  warehouseId: string;
  quantity: number | Decimal;
  createdById?: string;
  referenceType?: StockReferenceType | null;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
  allowNegative?: boolean; // Default: false
  /** When product.trackBatches: required. */
  batchId?: string | null;
  /** When product.trackSerials: required, length must equal quantity. */
  serialNumbers?: string[] | null;
  /** When product.trackSerials: status to set on OUT (default SOLD). */
  serialDisposition?: SerialDisposition;
}

export interface TransferStockParams {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number | Decimal;
  createdById?: string;
  referenceType?: StockReferenceType | null;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
  allowNegative?: boolean; // Default: false
  /** When product.trackBatches: required (source batch). */
  batchId?: string | null;
  /** When product.trackSerials: required, length must equal quantity. */
  serialNumbers?: string[] | null;
}

export type AdjustMethod = 'increase' | 'decrease' | 'set';

export interface AdjustStockParams {
  productId: string;
  warehouseId: string;
  method: AdjustMethod;
  quantity?: number | Decimal; // For increase/decrease
  newQuantity?: number | Decimal; // For set to exact
  reason: string; // damage, recount, correction, opening_stock
  notes?: string;
  createdById?: string;
  allowNegative?: boolean; // Default: false
  batchId?: string | null;
  batchInput?: BatchInput | null;
  serialNumbers?: string[] | null;
  serialDisposition?: SerialDisposition;
}

export interface StockOperationResult {
  success: boolean;
  stockBalance: {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  };
  stockMovement: {
    id: string;
    movementType: string;
    quantity: Decimal;
  };
  message?: string;
}

export interface TransferStockResult {
  success: boolean;
  fromBalance: {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    available: Decimal;
  };
  toBalance: {
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    available: Decimal;
  };
  stockMovement: {
    id: string;
    movementType: string;
    quantity: Decimal;
  };
  message?: string;
}

/** Single-line purchase receive: IN movement + balance update via StockService */
export interface ReceivePurchaseParams {
  productId: string;
  warehouseId: string;
  quantity: number | Decimal;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
  createdById?: string;
  batchId?: string | null;
  batchInput?: BatchInput | null;
  serialNumbers?: string[] | null;
}

/** Single-line sale confirm/paid: OUT movement + balance update via StockService */
export interface ConfirmSaleParams {
  productId: string;
  warehouseId: string;
  quantity: number | Decimal;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
  createdById?: string;
  allowNegative?: boolean;
  batchId?: string | null;
  serialNumbers?: string[] | null;
  serialDisposition?: SerialDisposition;
}
