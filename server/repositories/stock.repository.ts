import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class StockRepository {
  constructor(private prisma: PrismaClient | PrismaTransactionClient) {}

  /**
   * Get or create stock balance for a product in a warehouse
   */
  async getOrCreateStockBalance(
    productId: string,
    warehouseId: string
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  }> {
    return this.prisma.stockBalance.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
      update: {},
      create: {
        productId,
        warehouseId,
        quantity: 0,
        reserved: 0,
        available: 0,
      },
    });
  }

  /**
   * Get stock balance for a product in a warehouse
   */
  async getStockBalance(
    productId: string,
    warehouseId: string
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  } | null> {
    return this.prisma.stockBalance.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    });
  }

  /**
   * Update stock balance quantity
   */
  async updateStockBalance(
    productId: string,
    warehouseId: string,
    newQuantity: Decimal,
    newReserved: Decimal | null = null
  ): Promise<{
    id: string;
    productId: string;
    warehouseId: string;
    quantity: Decimal;
    reserved: Decimal;
    available: Decimal;
  }> {
    const balance = await this.getOrCreateStockBalance(productId, warehouseId);
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
   * Create stock movement (immutable ledger entry; never update/delete)
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
}
