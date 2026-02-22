import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { StockRepository } from '../repositories/stock.repository';
import { findOrCreateBatch, getBatchById } from '../repositories/batch.repository';
import * as serialRepo from '../repositories/productSerial.repository';
import { getInventoryRules } from './settingsService';
import {
  IncreaseStockParams,
  DecreaseStockParams,
  TransferStockParams,
  AdjustStockParams,
  ReceivePurchaseParams,
  ConfirmSaleParams,
  StockOperationResult,
  TransferStockResult,
} from '../types/stock.types';

/** Resolve allowNegative from params or Settings.allowNegativeStock (no negative stock unless enabled). */
async function resolveAllowNegative(explicitValue: boolean | undefined): Promise<boolean> {
  if (explicitValue !== undefined) return explicitValue;
  const rules = await getInventoryRules();
  return rules?.allowNegativeStock ?? false;
}

export class StockService {
  private repository: StockRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new StockRepository(prisma);
  }

  /**
   * Increase stock quantity in a warehouse.
   * When product.trackBatches: batchId or batchInput.batchNumber required (find-or-create batch).
   * When product.trackSerials: serialNumbers optional on IN; creates ProductSerial IN_STOCK.
   */
  async increaseStock(
    params: IncreaseStockParams
  ): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);

    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    const [productFlags, warehouseExists] = await Promise.all([
      this.repository.getProductTrackingFlags(params.productId),
      this.repository.verifyWarehouse(params.warehouseId),
    ]);

    if (!productFlags) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }
    if (!warehouseExists) {
      throw new Error(`Warehouse with ID ${params.warehouseId} not found`);
    }

    const { trackBatches, trackSerials } = productFlags;
    if (trackBatches) {
      const hasBatch = params.batchId ?? params.batchInput?.batchNumber;
      if (!hasBatch) {
        throw new Error('Batch-tracked product requires batchId or batchInput.batchNumber on IN');
      }
    }
    const serialCount = params.serialNumbers?.length ?? 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);
      let batchId: string | null = null;

      if (trackBatches && (params.batchId ?? params.batchInput?.batchNumber)) {
        if (params.batchId) {
          const batch = await getBatchById(tx, params.batchId);
          if (!batch || batch.productId !== params.productId) {
            throw new Error(`Batch ${params.batchId} not found or does not belong to this product`);
          }
          batchId = batch.id;
        } else if (params.batchInput?.batchNumber) {
          const batch = await findOrCreateBatch(tx, {
            productId: params.productId,
            batchNumber: params.batchInput.batchNumber,
            mfgDate: params.batchInput.mfgDate ?? undefined,
            expiryDate: params.batchInput.expiryDate ?? undefined,
            notes: params.batchInput.notes ?? undefined,
          });
          batchId = batch.id;
        }
      }

      const balance = await repo.getOrCreateStockBalance(
        params.productId,
        params.warehouseId,
        batchId
      );

      const currentQuantity = new Decimal(balance.quantity);
      const newQuantity = currentQuantity.plus(quantity);

      const updatedBalance = await repo.updateStockBalance(
        params.productId,
        params.warehouseId,
        newQuantity,
        null,
        batchId
      );

      const movement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.warehouseId,
        movementType: 'IN',
        quantity,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        referenceNumber: params.referenceNumber,
        notes: params.notes,
        createdById: params.createdById,
        batchId,
        serialCount: serialCount > 0 ? serialCount : undefined,
      });

      if (trackSerials && params.serialNumbers && params.serialNumbers.length > 0) {
        await serialRepo.createSerials(tx, {
          productId: params.productId,
          serialNumbers: params.serialNumbers,
          warehouseId: params.warehouseId,
          batchId,
          movementId: movement.id,
        });
      }

      await repo.createAuditLog({
        userId: params.createdById,
        action: 'UPDATE',
        resource: 'stock_balance',
        resourceId: updatedBalance.id,
        description: `Increased stock by ${quantity.toString()} units for product ${params.productId} in warehouse ${params.warehouseId}`,
        metadata: {
          productId: params.productId,
          warehouseId: params.warehouseId,
          movementId: movement.id,
          previousQuantity: balance.quantity.toString(),
          newQuantity: newQuantity.toString(),
          quantityChange: quantity.toString(),
          batchId: batchId ?? undefined,
        },
      });

      return {
        stockBalance: updatedBalance,
        stockMovement: movement,
      };
    });

    return {
      success: true,
      stockBalance: result.stockBalance,
      stockMovement: result.stockMovement,
      message: `Stock increased by ${quantity.toString()} units`,
    };
  }

  /**
   * Decrease stock quantity in a warehouse.
   * When product.trackBatches: batchId required.
   * When product.trackSerials: serialNumbers required and length must equal quantity; serials marked SOLD/DAMAGED/RETURNED.
   */
  async decreaseStock(
    params: DecreaseStockParams
  ): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);
    const allowNegative = await resolveAllowNegative(params.allowNegative);

    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    const [productFlags, warehouseExists] = await Promise.all([
      this.repository.getProductTrackingFlags(params.productId),
      this.repository.verifyWarehouse(params.warehouseId),
    ]);

    if (!productFlags) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }
    if (!warehouseExists) {
      throw new Error(`Warehouse with ID ${params.warehouseId} not found`);
    }

    const { trackBatches, trackSerials } = productFlags;
    if (trackBatches && params.batchId == null) {
      throw new Error('Batch-tracked product requires batchId on OUT');
    }
    if (trackSerials) {
      const sn = params.serialNumbers ?? [];
      if (sn.length !== Number(quantity)) {
        throw new Error(
          `Serial-tracked product requires serialNumbers array length equal to quantity (${quantity.toString()}), got ${sn.length}`
        );
      }
    }

    const serialDisposition = params.serialDisposition ?? 'SOLD';

    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);
      const batchId = trackBatches ? params.batchId ?? null : null;

      let serialIds: string[] = [];
      if (trackSerials && params.serialNumbers && params.serialNumbers.length > 0) {
        const serials = await serialRepo.findSerialsForOut(tx, {
          productId: params.productId,
          serialNumbers: params.serialNumbers,
          warehouseId: params.warehouseId,
          batchId: batchId ?? undefined,
        });
        serialIds = serials.map((s) => s.id);
      }

      const balance = await repo.getOrCreateStockBalance(
        params.productId,
        params.warehouseId,
        batchId
      );

      const currentQuantity = new Decimal(balance.quantity);
      const newQuantity = currentQuantity.minus(quantity);

      if (!allowNegative && newQuantity.lt(0)) {
        throw new Error(
          `Insufficient stock. Available: ${balance.available.toString()}, Requested: ${quantity.toString()}`
        );
      }

      const updatedBalance = await repo.updateStockBalance(
        params.productId,
        params.warehouseId,
        newQuantity,
        null,
        batchId
      );

      const movement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.warehouseId,
        movementType: 'OUT',
        quantity,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        referenceNumber: params.referenceNumber,
        notes: params.notes,
        createdById: params.createdById,
        batchId,
        serialCount: serialIds.length > 0 ? serialIds.length : undefined,
      });

      if (serialIds.length > 0) {
        await serialRepo.updateSerialsStatus(tx, {
          serialIds,
          status: serialDisposition,
          movementId: movement.id,
          disposedAt: new Date(),
        });
      }

      await repo.createAuditLog({
        userId: params.createdById,
        action: 'UPDATE',
        resource: 'stock_balance',
        resourceId: updatedBalance.id,
        description: `Decreased stock by ${quantity.toString()} units for product ${params.productId} in warehouse ${params.warehouseId}`,
        metadata: {
          productId: params.productId,
          warehouseId: params.warehouseId,
          movementId: movement.id,
          previousQuantity: balance.quantity.toString(),
          newQuantity: newQuantity.toString(),
          quantityChange: `-${quantity.toString()}`,
          allowNegative,
          batchId: batchId ?? undefined,
        },
      });

      return {
        stockBalance: updatedBalance,
        stockMovement: movement,
      };
    });

    return {
      success: true,
      stockBalance: result.stockBalance,
      stockMovement: result.stockMovement,
      message: `Stock decreased by ${quantity.toString()} units`,
    };
  }

  /**
   * Transfer stock between warehouses.
   * When product.trackBatches: batchId required (same batch at source and dest).
   * When product.trackSerials: serialNumbers required, length equal to quantity; serials get warehouseId updated to destination.
   */
  async transferStock(
    params: TransferStockParams
  ): Promise<TransferStockResult> {
    const quantity = new Decimal(params.quantity);
    const allowNegative = await resolveAllowNegative(params.allowNegative);

    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    if (params.fromWarehouseId === params.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    const [productFlags, fromWhExists, toWhExists] = await Promise.all([
      this.repository.getProductTrackingFlags(params.productId),
      this.repository.verifyWarehouse(params.fromWarehouseId),
      this.repository.verifyWarehouse(params.toWarehouseId),
    ]);

    if (!productFlags) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }
    if (!fromWhExists) {
      throw new Error(`Source warehouse with ID ${params.fromWarehouseId} not found`);
    }
    if (!toWhExists) {
      throw new Error(`Destination warehouse with ID ${params.toWarehouseId} not found`);
    }

    const { trackBatches, trackSerials } = productFlags;
    if (trackBatches && params.batchId == null) {
      throw new Error('Batch-tracked product requires batchId for transfer');
    }
    if (trackSerials) {
      const sn = params.serialNumbers ?? [];
      if (sn.length !== Number(quantity)) {
        throw new Error(
          `Serial-tracked product requires serialNumbers array length equal to quantity (${quantity.toString()}), got ${sn.length}`
        );
      }
    }

    const batchId = trackBatches ? params.batchId ?? null : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);

      let serialIds: string[] = [];
      if (trackSerials && params.serialNumbers && params.serialNumbers.length > 0) {
        const serials = await serialRepo.findSerialsForOut(tx, {
          productId: params.productId,
          serialNumbers: params.serialNumbers,
          warehouseId: params.fromWarehouseId,
          batchId: batchId ?? undefined,
        });
        serialIds = serials.map((s) => s.id);
      }

      const fromBalance = await repo.getOrCreateStockBalance(
        params.productId,
        params.fromWarehouseId,
        batchId
      );
      const toBalance = await repo.getOrCreateStockBalance(
        params.productId,
        params.toWarehouseId,
        batchId
      );

      const fromCurrentQuantity = new Decimal(fromBalance.quantity);
      const fromNewQuantity = fromCurrentQuantity.minus(quantity);
      const toCurrentQuantity = new Decimal(toBalance.quantity);
      const toNewQuantity = toCurrentQuantity.plus(quantity);

      if (!allowNegative && fromNewQuantity.lt(0)) {
        throw new Error(
          `Insufficient stock in source warehouse. Available: ${fromBalance.available.toString()}, Requested: ${quantity.toString()}`
        );
      }

      const transferId = randomUUID();
      const referenceNumber = params.referenceNumber ?? `TRF-${transferId.slice(0, 8)}`;

      const fromMovement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.fromWarehouseId,
        movementType: 'OUT',
        quantity,
        referenceType: 'TRANSFER',
        referenceId: transferId,
        referenceNumber,
        notes: params.notes
          ? `Transfer to ${params.toWarehouseId}: ${params.notes}`
          : `Transfer to ${params.toWarehouseId}`,
        createdById: params.createdById,
        batchId,
        serialCount: serialIds.length > 0 ? serialIds.length : undefined,
      });

      const toMovement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.toWarehouseId,
        movementType: 'IN',
        quantity,
        referenceType: 'TRANSFER',
        referenceId: transferId,
        referenceNumber,
        notes: params.notes
          ? `Transfer from ${params.fromWarehouseId}: ${params.notes}`
          : `Transfer from ${params.fromWarehouseId}`,
        createdById: params.createdById,
        batchId,
        serialCount: serialIds.length > 0 ? serialIds.length : undefined,
      });

      if (serialIds.length > 0) {
        await serialRepo.updateSerialsWarehouse(tx, {
          serialIds,
          warehouseId: params.toWarehouseId,
          movementId: toMovement.id,
        });
      }

      const updatedFromBalance = await repo.updateStockBalance(
        params.productId,
        params.fromWarehouseId,
        fromNewQuantity,
        null,
        batchId
      );

      const updatedToBalance = await repo.updateStockBalance(
        params.productId,
        params.toWarehouseId,
        toNewQuantity,
        null,
        batchId
      );

      await repo.createAuditLog({
        userId: params.createdById,
        action: 'UPDATE',
        resource: 'stock_transfer',
        resourceId: `${fromMovement.id}-${toMovement.id}`,
        description: `Transferred ${quantity.toString()} units of product ${params.productId} from warehouse ${params.fromWarehouseId} to ${params.toWarehouseId}`,
        metadata: {
          productId: params.productId,
          fromWarehouseId: params.fromWarehouseId,
          toWarehouseId: params.toWarehouseId,
          fromMovementId: fromMovement.id,
          toMovementId: toMovement.id,
          quantity: quantity.toString(),
          fromPreviousQuantity: fromBalance.quantity.toString(),
          fromNewQuantity: fromNewQuantity.toString(),
          toPreviousQuantity: toBalance.quantity.toString(),
          toNewQuantity: toNewQuantity.toString(),
          allowNegative,
          batchId: batchId ?? undefined,
        },
      });

      return {
        fromBalance: updatedFromBalance,
        toBalance: updatedToBalance,
        stockMovement: toMovement,
      };
    });

    return {
      success: true,
      fromBalance: result.fromBalance,
      toBalance: result.toBalance,
      stockMovement: result.stockMovement,
      message: `Transferred ${quantity.toString()} units from warehouse ${params.fromWarehouseId} to ${params.toWarehouseId}`,
    };
  }

  /**
   * Adjust stock: increase, decrease, or set to exact quantity.
   * Passes through batchId, batchInput, serialNumbers, serialDisposition when product is batch/serial-tracked.
   */
  async adjustStock(params: AdjustStockParams): Promise<StockOperationResult> {
    const allowNegative = await resolveAllowNegative(params.allowNegative);
    const notes = params.notes
      ? `${params.reason}: ${params.notes}`
      : params.reason;
    const referenceNumber = `ADJ-${params.reason}-${Date.now()}`;

    const passBatchSerial = {
      batchId: params.batchId,
      batchInput: params.batchInput,
      serialNumbers: params.serialNumbers,
      serialDisposition: params.serialDisposition,
    };

    if (params.method === 'increase') {
      const q = params.quantity != null ? new Decimal(params.quantity) : null;
      if (q == null || q.lte(0)) {
        throw new Error('Quantity must be greater than zero for increase');
      }
      return this.increaseStock({
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: q,
        createdById: params.createdById,
        referenceType: 'ADJUSTMENT',
        referenceNumber,
        notes,
        ...passBatchSerial,
      });
    }

    if (params.method === 'decrease') {
      const q = params.quantity != null ? new Decimal(params.quantity) : null;
      if (q == null || q.lte(0)) {
        throw new Error('Quantity must be greater than zero for decrease');
      }
      return this.decreaseStock({
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: q,
        createdById: params.createdById,
        referenceType: 'ADJUSTMENT',
        referenceNumber,
        notes,
        allowNegative,
        ...passBatchSerial,
      });
    }

    // method === 'set'
    const newQty = params.newQuantity != null ? new Decimal(params.newQuantity) : null;
    if (newQty == null || newQty.lt(0)) {
      throw new Error('New quantity must be a non-negative number for set to exact');
    }
    const balance = await this.repository.getOrCreateStockBalance(
      params.productId,
      params.warehouseId,
      params.batchId ?? null
    );
    const current = new Decimal(balance.quantity);
    const delta = newQty.minus(current);

    if (delta.eq(0)) {
      return {
        success: true,
        stockBalance: {
          id: balance.id,
          productId: balance.productId,
          warehouseId: balance.warehouseId,
          quantity: balance.quantity,
          reserved: balance.reserved,
          available: balance.available,
        },
        stockMovement: {
          id: '',
          movementType: 'IN',
          quantity: new Decimal(0),
        },
        message: 'No change: quantity already at target',
      };
    }

    if (delta.gt(0)) {
      return this.increaseStock({
        productId: params.productId,
        warehouseId: params.warehouseId,
        quantity: delta,
        createdById: params.createdById,
        referenceType: 'ADJUSTMENT',
        referenceNumber,
        notes: `${notes} (set to ${newQty.toString()})`,
        ...passBatchSerial,
      });
    }

    const absDelta = delta.abs();
    return this.decreaseStock({
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: absDelta,
      createdById: params.createdById,
      referenceType: 'ADJUSTMENT',
      referenceNumber,
      notes: `${notes} (set to ${newQty.toString()})`,
      allowNegative,
      ...passBatchSerial,
    });
  }

  /**
   * Purchase receive: IN movement + balance update.
   * All stock-in from purchases must go through this (or increaseStock with referenceType PURCHASE).
   */
  async receivePurchase(params: ReceivePurchaseParams): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);
    if (quantity.lte(0)) throw new Error('Quantity must be greater than zero');
    return this.increaseStock({
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: params.quantity,
      referenceType: 'PURCHASE',
      referenceId: params.referenceId ?? null,
      referenceNumber: params.referenceNumber,
      notes: params.notes,
      createdById: params.createdById,
      batchId: params.batchId,
      batchInput: params.batchInput,
      serialNumbers: params.serialNumbers,
    });
  }

  /**
   * Sale confirm/paid: OUT movement + balance update.
   * All stock-out from sales must go through this (or decreaseStock with referenceType SALE).
   * Respects allowNegativeStock when allowNegative is not passed.
   */
  async confirmSale(params: ConfirmSaleParams): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);
    if (quantity.lte(0)) throw new Error('Quantity must be greater than zero');
    return this.decreaseStock({
      productId: params.productId,
      warehouseId: params.warehouseId,
      quantity: params.quantity,
      referenceType: 'SALE',
      referenceId: params.referenceId ?? null,
      referenceNumber: params.referenceNumber,
      notes: params.notes,
      createdById: params.createdById,
      allowNegative: params.allowNegative,
      batchId: params.batchId,
      serialNumbers: params.serialNumbers,
      serialDisposition: params.serialDisposition,
    });
  }
}
