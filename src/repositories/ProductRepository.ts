import { prisma } from "@/lib/prisma";
import { Product, ProductStatus } from "@/domain/Product";

export class ProductRepository {
  static toDomain(row: {
    productId: number;
    name: string;
    category: string;
    originalPrice: number;
    currentPrice: number;
    expiryDateTime: Date;
    status: string;
    storeId: number;
    pricingRuleId: number | null;
  }): Product {
    return new Product({
      productId: row.productId,
      name: row.name,
      category: row.category,
      originalPrice: row.originalPrice,
      currentPrice: row.currentPrice,
      expiryDateTime: row.expiryDateTime,
      status: row.status as ProductStatus,
      storeId: row.storeId,
      pricingRuleId: row.pricingRuleId ?? undefined,
      skipExpiryCheck: true,
    });
  }

  static async findById(productId: number): Promise<Product | null> {
    const row = await prisma.product.findUnique({
      where: { productId },
    });
    return row ? this.toDomain(row) : null;
  }

  static async findActiveNonExpired(now: Date): Promise<Product[]> {
    const rows = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        expiryDateTime: { gt: now },
      },
      include: {
        inventoryItem: true,
      },
    });

    return rows
      .filter((r) => r.inventoryItem && (r.inventoryItem.quantity - r.inventoryItem.reservedQuantity) > 0)
      .map((r) => this.toDomain(r));
  }

  static async updatePrice(
    productId: number,
    newPrice: number,
    reason?: string
  ): Promise<void> {
    await prisma.$transaction([
      prisma.product.update({
        where: { productId },
        data: { currentPrice: newPrice },
      }),
      prisma.priceHistory.create({
        data: {
          productId,
          price: newPrice,
          reason: reason ?? "HOURLY_DECAY",
        },
      }),
    ]);
  }

  static async updateStatus(
    productId: number,
    status: ProductStatus
  ): Promise<void> {
    await prisma.product.update({
      where: { productId },
      data: { status },
    });
  }
}
