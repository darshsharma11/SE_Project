import { prisma } from "@/lib/prisma";
import { InventoryItem } from "@/domain/InventoryItem";

export class InventoryItemRepository {
  static toDomain(row: {
    inventoryId: number;
    quantity: number;
    reservedQuantity: number;
    productId: number;
  }): InventoryItem {
    return new InventoryItem({
      inventoryId: row.inventoryId,
      quantity: row.quantity,
      reservedQuantity: row.reservedQuantity,
      productId: row.productId,
    });
  }

  static async findByProductId(productId: number): Promise<InventoryItem | null> {
    const row = await prisma.inventoryItem.findUnique({
      where: { productId },
    });
    return row ? this.toDomain(row) : null;
  }

  static async update(item: InventoryItem): Promise<void> {
    await prisma.inventoryItem.update({
      where: { inventoryId: item.inventoryId },
      data: {
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
      },
    });
  }
}
