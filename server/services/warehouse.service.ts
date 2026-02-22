import { PrismaClient } from '@prisma/client';
import { WarehouseRepository } from '../repositories/warehouse.repository';
import type {
  WarehouseListFilters,
  WarehouseListResult,
  WarehouseStockRow,
  MovementRow,
  TransferRow,
} from '../repositories/warehouse.repository';

export class WarehouseService {
  private repository: WarehouseRepository;

  constructor(private prisma: PrismaClient) {
    this.repository = new WarehouseRepository(prisma);
  }

  async listWarehouses(
    filters: WarehouseListFilters,
    page: number,
    limit: number,
    sortBy: string,
    sortDir: 'asc' | 'desc'
  ): Promise<{ list: WarehouseListResult[]; total: number }> {
    const skip = (page - 1) * limit;
    return this.repository.getWarehouseListWithStats(
      filters,
      skip,
      limit,
      sortBy,
      sortDir
    );
  }

  async getWarehouseById(warehouseId: string) {
    return this.repository.getWarehouseByIdWithStats(warehouseId);
  }

  async createWarehouse(data: {
    name: string;
    code?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  }) {
    if (data.code) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw new Error(`Warehouse with code '${data.code}' already exists`);
      }
    }
    return this.repository.create(data);
  }

  async updateWarehouse(
    id: string,
    data: {
      name?: string;
      code?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    }
  ) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error('Warehouse not found');
    }
    if (data.code != null && data.code !== existing.code) {
      const duplicate = await this.prisma.warehouse.findUnique({
        where: { code: data.code },
      });
      if (duplicate) {
        throw new Error(`Warehouse with code '${data.code}' already exists`);
      }
    }
    return this.repository.update(id, data);
  }

  async deactivateWarehouse(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new Error('Warehouse not found');
    }
    return this.repository.update(id, { isActive: false });
  }

  async getWarehouseStock(
    warehouseId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
      lowStockOnly?: boolean;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
    }
  ): Promise<{ rows: WarehouseStockRow[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    return this.repository.getStockTable(warehouseId, {
      skip,
      take: options.limit,
      search: options.search,
      lowStockOnly: options.lowStockOnly,
      sortBy: options.sortBy,
      sortDir: options.sortDir,
    });
  }

  async getWarehouseMovements(
    warehouseId: string,
    options: {
      page: number;
      limit: number;
      type?: string;
      productId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ rows: MovementRow[]; total: number }> {
    const skip = (options.page - 1) * options.limit;
    const dateFrom = options.dateFrom ? new Date(options.dateFrom) : undefined;
    const dateTo = options.dateTo ? new Date(options.dateTo) : undefined;
    return this.repository.getMovements(warehouseId, {
      skip,
      take: options.limit,
      type: options.type,
      productId: options.productId,
      dateFrom,
      dateTo,
    });
  }

  async getWarehouseTransfers(
    warehouseId: string,
    page: number,
    limit: number
  ): Promise<{ rows: TransferRow[]; total: number }> {
    const skip = (page - 1) * limit;
    return this.repository.getTransfersInvolvingWarehouse(
      warehouseId,
      skip,
      limit
    );
  }

  async getMovementTrend(
    warehouseId: string,
    days: number
  ): Promise<{ date: string; in: number; out: number }[]> {
    return this.repository.getMovementTrend(warehouseId, days);
  }

  async getTopMovedProducts(
    warehouseId: string,
    days: number,
    limit: number
  ): Promise<{ productId: string; productName: string; sku: string; totalQty: number }[]> {
    return this.repository.getTopMovedProducts(warehouseId, days, limit);
  }

  async getWarehouseAuditLogs(
    warehouseId: string,
    page: number,
    limit: number
  ): Promise<{
    rows: { id: string; action: string; description: string | null; createdAt: Date; userName: string | null }[];
    total: number;
  }> {
    const skip = (page - 1) * limit;
    return this.repository.getAuditLogs('warehouse', warehouseId, skip, limit);
  }

  async getAggregateStats(): Promise<{
    totalWarehouses: number;
    totalStockValue: number;
    totalLowStockItems: number;
    transfersThisWeek: number;
  }> {
    return this.repository.getAggregateStats();
  }

  async exportStockCsv(warehouseId: string): Promise<string> {
    const { rows } = await this.repository.getStockTable(warehouseId, {
      skip: 0,
      take: 100_000,
    });
    const header = 'Product Name,SKU,Category,On Hand,Reorder Level,Value,Last Updated\n';
    const lines = rows.map(
      (r) =>
        `"${(r.productName ?? '').replace(/"/g, '""')}",${r.sku},"${(r.category ?? '').replace(/"/g, '""')}",${r.onHand},${r.reorderLevel ?? ''},${r.value.toFixed(2)},${r.lastUpdated.toISOString()}`
    );
    return header + lines.join('\n');
  }
}
