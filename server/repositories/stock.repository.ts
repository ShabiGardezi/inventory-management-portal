import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class StockRepository {
  constructor(private prisma: PrismaClient | PrismaTransactionClient) {}

  /**
   * Get or create stock balance for a product in a warehouse (non-batch when batchId omitted).
   * For batch-tracked products pass batchId.
   */
  async getOrCreateStockBalance(
    productId: string,
    warehouseId: string,
    batchId?: string | null
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  }> {
    const bid = batchId ?? null;
    if (bid !== null) {
      return this.prisma.stockBalance.upsert({
        where: {
          productId_warehouseId_batchId: { productId, warehouseId, batchId: bid },
        },
        update: {},
        create: {
          productId,
          warehouseId,
          batchId: bid,
          quantity: 0,
          reserved: 0,
          available: 0,
        },
      });
    }
    const existing = await this.prisma.stockBalance.findFirst({
      where: { productId, warehouseId, batchId: null },
    });
    if (existing) return existing;
    return this.prisma.stockBalance.create({
      data: {
        productId,
        warehouseId,
        batchId: null,
        quantity: 0,
        reserved: 0,
        available: 0,
      },
    });
  }

  /**
   * Get stock balance for a product in a warehouse (non-batch when batchId omitted).
   */
  async getStockBalance(
    productId: string,
    warehouseId: string,
    batchId?: string | null
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  } | null> {
    const bid = batchId ?? null;
    if (bid !== null) {
      return this.prisma.stockBalance.findUnique({
        where: {
          productId_warehouseId_batchId: { productId, warehouseId, batchId: bid },
        },
      });
    }
    return this.prisma.stockBalance.findFirst({
      where: { productId, warehouseId, batchId: null },
    });
  }

  /**
   * Update stock balance quantity (non-batch when batchId omitted).
   */
  async updateStockBalance(
    productId: string,
    warehouseId: string,
    newQuantity: Decimal,
    newReserved: Decimal | null = null,
    batchId?: string | null
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  }> {
    const balance = await this.getOrCreateStockBalance(productId, warehouseId, batchId);
    const reserved = newReserved !== null ? newReserved : balance.reserved;
    const available = new Decimal(newQuantity).minus(new Decimal(reserved));

    return this.prisma.stockBalance.update({
      where: {
        id: balance.id,
      },
      data: {
        quantity: newQuantity,
        reserved: reserved,
        available: available,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Create stock movement (immutable ledger entry; never update/delete).
   * Always set createdById (performedByUserId) when a user performs the action; createdAt is set by DB.
   */
  async createStockMovement(
    data: {
      productId: string;
      warehouseId: string;
      movementType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
      quantity: Decimal;
      referenceType?: 'PURCHASE' | 'SALE' | 'TRANSFER' | 'ADJUSTMENT' | 'MANUAL' | null;
      referenceId?: string | null;
      referenceNumber?: string | null;
      notes?: string | null;
      createdById?: string | null;
      batchId?: string | null;
      serialCount?: number | null;
    }
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    movementType: string;
    quantity: Decimal;
  }> {
    return this.prisma.stockMovement.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        movementType: data.movementType,
        quantity: data.quantity,
        referenceType: data.referenceType ?? undefined,
        referenceId: data.referenceId ?? undefined,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        createdById: data.createdById,
        batchId: data.batchId ?? undefined,
        serialCount: data.serialCount ?? undefined,
      },
    });
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(
    data: {
      userId?: string | null;
      action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'PERMISSION_DENIED';
      resource: string;
      resourceId?: string | null;
      description?: string | null;
      metadata?: Prisma.JsonValue | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    }
  ): Promise<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
  }> {
    return this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        description: data.description,
        metadata: data.metadata == null ? undefined : (data.metadata as Prisma.InputJsonValue),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Verify product exists
   */
  async verifyProduct(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    return !!product;
  }

  /**
   * Verify warehouse exists
   */
  async verifyWarehouse(warehouseId: string): Promise<boolean> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    });
    return !!warehouse;
  }

  /**
   * Get product tracking flags (for batch/serial validation).
   */
  async getProductTrackingFlags(productId: string): Promise<{
    trackBatches: boolean;
    trackSerials: boolean;
  } | null> {
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { trackBatches: true, trackSerials: true },
    });
    return p ?? null;
  }
}
