import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { StockRepository } from '../repositories/stock.repository';
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

export class StockService {
  private repository: StockRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new StockRepository(prisma);
  }

  /**
   * Increase stock quantity in a warehouse
   * Creates stock movement record and updates stock balance
   */
  async increaseStock(
    params: IncreaseStockParams
  ): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);

    // Validate quantity
    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    // Verify product and warehouse exist
    const [productExists, warehouseExists] = await Promise.all([
      this.repository.verifyProduct(params.productId),
      this.repository.verifyWarehouse(params.warehouseId),
    ]);

    if (!productExists) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }

    if (!warehouseExists) {
      throw new Error(`Warehouse with ID ${params.warehouseId} not found`);
    }

    // Execute transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);

      // Get or create stock balance
      const balance = await repo.getOrCreateStockBalance(
        params.productId,
        params.warehouseId
      );

      // Calculate new quantity
      const currentQuantity = new Decimal(balance.quantity);
      const newQuantity = currentQuantity.plus(quantity);

      // Update stock balance
      const updatedBalance = await repo.updateStockBalance(
        params.productId,
        params.warehouseId,
        newQuantity
      );

      // Create stock movement
      const movement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.warehouseId,
        movementType: 'IN',
        quantity: quantity,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        referenceNumber: params.referenceNumber,
        notes: params.notes,
        createdById: params.createdById,
      });

      // Create audit log
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
   * Decrease stock quantity in a warehouse
   * Creates stock movement record and updates stock balance
   * Prevents negative stock unless allowNegative is true
   */
  async decreaseStock(
    params: DecreaseStockParams
  ): Promise<StockOperationResult> {
    const quantity = new Decimal(params.quantity);
    const allowNegative = params.allowNegative ?? false;

    // Validate quantity
    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    // Verify product and warehouse exist
    const [productExists, warehouseExists] = await Promise.all([
      this.repository.verifyProduct(params.productId),
      this.repository.verifyWarehouse(params.warehouseId),
    ]);

    if (!productExists) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }

    if (!warehouseExists) {
      throw new Error(`Warehouse with ID ${params.warehouseId} not found`);
    }

    // Execute transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);

      // Get stock balance
      const balance = await repo.getOrCreateStockBalance(
        params.productId,
        params.warehouseId
      );

      // Calculate new quantity
      const currentQuantity = new Decimal(balance.quantity);
      const newQuantity = currentQuantity.minus(quantity);

      // Check for negative stock
      if (!allowNegative && newQuantity.lt(0)) {
        throw new Error(
          `Insufficient stock. Available: ${balance.available.toString()}, Requested: ${quantity.toString()}`
        );
      }

      // Update stock balance
      const updatedBalance = await repo.updateStockBalance(
        params.productId,
        params.warehouseId,
        newQuantity
      );

      // Create stock movement
      const movement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.warehouseId,
        movementType: 'OUT',
        quantity: quantity,
        referenceType: params.referenceType ?? null,
        referenceId: params.referenceId ?? null,
        referenceNumber: params.referenceNumber,
        notes: params.notes,
        createdById: params.createdById,
      });

      // Create audit log
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
   * Transfer stock between warehouses
   * Creates stock movements for both warehouses and updates both balances
   * Prevents negative stock in source warehouse unless allowNegative is true
   */
  async transferStock(
    params: TransferStockParams
  ): Promise<TransferStockResult> {
    const quantity = new Decimal(params.quantity);
    const allowNegative = params.allowNegative ?? false;

    // Validate quantity
    if (quantity.lte(0)) {
      throw new Error('Quantity must be greater than zero');
    }

    // Validate different warehouses
    if (params.fromWarehouseId === params.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    // Verify product and warehouses exist
    const [productExists, fromWarehouseExists, toWarehouseExists] =
      await Promise.all([
        this.repository.verifyProduct(params.productId),
        this.repository.verifyWarehouse(params.fromWarehouseId),
        this.repository.verifyWarehouse(params.toWarehouseId),
      ]);

    if (!productExists) {
      throw new Error(`Product with ID ${params.productId} not found`);
    }

    if (!fromWarehouseExists) {
      throw new Error(
        `Source warehouse with ID ${params.fromWarehouseId} not found`
      );
    }

    if (!toWarehouseExists) {
      throw new Error(
        `Destination warehouse with ID ${params.toWarehouseId} not found`
      );
    }

    // Execute transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const repo = new StockRepository(tx);

      // Get stock balances for both warehouses
      const fromBalance = await repo.getOrCreateStockBalance(
        params.productId,
        params.fromWarehouseId
      );
      const toBalance = await repo.getOrCreateStockBalance(
        params.productId,
        params.toWarehouseId
      );

      // Calculate new quantities
      const fromCurrentQuantity = new Decimal(fromBalance.quantity);
      const fromNewQuantity = fromCurrentQuantity.minus(quantity);

      const toCurrentQuantity = new Decimal(toBalance.quantity);
      const toNewQuantity = toCurrentQuantity.plus(quantity);

      // Check for negative stock in source warehouse
      if (!allowNegative && fromNewQuantity.lt(0)) {
        throw new Error(
          `Insufficient stock in source warehouse. Available: ${fromBalance.available.toString()}, Requested: ${quantity.toString()}`
        );
      }

      // Shared transfer id for both movements (ledger rule: same referenceId)
      const transferId = randomUUID();
      const referenceNumber = params.referenceNumber ?? `TRF-${transferId.slice(0, 8)}`;

      // Create both stock movements in one transaction (source: -qty, dest: +qty)
      const fromMovement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.fromWarehouseId,
        movementType: 'OUT',
        quantity: quantity,
        referenceType: 'TRANSFER',
        referenceId: transferId,
        referenceNumber,
        notes: params.notes
          ? `Transfer to ${params.toWarehouseId}: ${params.notes}`
          : `Transfer to ${params.toWarehouseId}`,
        createdById: params.createdById,
      });

      const toMovement = await repo.createStockMovement({
        productId: params.productId,
        warehouseId: params.toWarehouseId,
        movementType: 'IN',
        quantity: quantity,
        referenceType: 'TRANSFER',
        referenceId: transferId,
        referenceNumber,
        notes: params.notes
          ? `Transfer from ${params.fromWarehouseId}: ${params.notes}`
          : `Transfer from ${params.fromWarehouseId}`,
        createdById: params.createdById,
      });

      // Update both stock balances after creating movements (ledger first, then balance)
      const updatedFromBalance = await repo.updateStockBalance(
        params.productId,
        params.fromWarehouseId,
        fromNewQuantity
      );

      const updatedToBalance = await repo.updateStockBalance(
        params.productId,
        params.toWarehouseId,
        toNewQuantity
      );

      // Create audit log for transfer
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
        },
      });

      return {
        fromBalance: updatedFromBalance,
        toBalance: updatedToBalance,
        stockMovement: toMovement, // Return the IN movement as primary
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
   * Creates IN/OUT movement with referenceType ADJUSTMENT; never edits ledger.
   */
  async adjustStock(params: AdjustStockParams): Promise<StockOperationResult> {
    const allowNegative = params.allowNegative ?? false;
    const notes = params.notes
      ? `${params.reason}: ${params.notes}`
      : params.reason;
    const referenceNumber = `ADJ-${params.reason}-${Date.now()}`;

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
      });
    }

    // method === 'set'
    const newQty = params.newQuantity != null ? new Decimal(params.newQuantity) : null;
    if (newQty == null || newQty.lt(0)) {
      throw new Error('New quantity must be a non-negative number for set to exact');
    }
    const balance = await this.repository.getOrCreateStockBalance(
      params.productId,
      params.warehouseId
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
    });
  }
}
