import { Decimal } from '@prisma/client/runtime/library';

export type StockReferenceType = 'PURCHASE' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'MANUAL';

export interface IncreaseStockParams {
  productId: string;
  warehouseId: string;
  quantity: number | Decimal;
  createdById?: string;
  referenceType?: StockReferenceType | null;
  referenceId?: string | null;
  referenceNumber?: string;
  notes?: string;
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
}
