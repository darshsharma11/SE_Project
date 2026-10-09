import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { trace } from "@/lib/trace";
import { Product, ProductStatus } from "@/domain/Product";
import { InventoryItem } from "@/domain/InventoryItem";
import { PricingRule } from "@/domain/PricingRule";
import { PricingEngine } from "@/domain/PricingEngine";
import { getExpiryBand, ExpiryBand } from "@/lib/config";
import { ProductRepository } from "@/repositories/ProductRepository";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export interface SearchFilters {
  keyword?: string;
  category?: string;
  store?: string | number;
  band?: ExpiryBand;
  maxPrice?: number;
  minDiscount?: number;
  sort?: "discount_desc" | "price_asc" | "expiry_asc";
}

export interface MarketplaceProductDTO {
  id: number;
  name: string;
  category: string;
  store: {
    id: number;
    name: string;
    address: string;
  };
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  hoursRemaining: number;
  expiryDateTime: string;
  expiryBand: ExpiryBand;
  availableQuantity: number;
  nextPriceUpdateAt: string;
}

export class MarketplaceService {
  private pricingEngine: PricingEngine;

  constructor() {
    this.pricingEngine = new PricingEngine();
  }

  /**
   * Sequence Steps 1 through 14:
   * 1 searchProduct(productName) Customer -> Marketplace
   * 2 getProductDetails() Marketplace -> Product
   * 3 productDetails Product -> Marketplace
   * 4 checkAvailability() Product -> InventoryItem
   * 5 stockStatus InventoryItem -> Product
   * (Alt: 46 stockUnavailable -> 47/48 productUnavailable)
   * 6 calculateCurrentPrice(Product) Marketplace -> PricingEngine
   * 7 getExpiryDetails() PricingEngine -> Product
   * 8 expiryDateTime Product -> PricingEngine
   * 9 calculateDiscount(expiryTime) PricingEngine -> PricingRule
   * 10 discountRate PricingRule -> PricingEngine
   * 11 updatePrice(discountedPrice) PricingEngine -> Product
   * 12 priceUpdated Product -> PricingEngine
   * 13 currentPrice PricingEngine -> Marketplace
   * 14 displayProductAndPrice() Marketplace -> Customer
   */
  async searchProduct(
    keyword = "",
    filters: SearchFilters = {},
    customCorrelationId?: string
  ): Promise<{
    products: MarketplaceProductDTO[];
    total: number;
    correlationId: string;
  }> {
    const correlationId =
      customCorrelationId ?? trace.generateCorrelationId("search");
    const now = clock.now();

    // Step 1: Customer -> Marketplace searchProduct(productName)
    await trace.step({
      correlationId,
      stepNumber: 1,
      label: "searchProduct(productName)",
      from: "Customer",
      to: "Marketplace",
      details: { keyword, filters, timestamp: now.toISOString() },
    });

    // Query active candidates with store and inventory
    const queryWhere: any = {
      status: "ACTIVE",
      expiryDateTime: { gt: now },
      store: {
        status: "VERIFIED",
      },
    };

    if (keyword && keyword.trim().length > 0) {
      queryWhere.OR = [
        { name: { contains: keyword } },
        { category: { contains: keyword } },
      ];
    }

    if (filters.category && filters.category !== "ALL") {
      queryWhere.category = filters.category;
    }

    if (filters.store) {
      const storeIdNum = Number(filters.store);
      if (!isNaN(storeIdNum) && storeIdNum > 0) {
        queryWhere.storeId = storeIdNum;
      } else {
        queryWhere.store = {
          ...queryWhere.store,
          storeName: { contains: String(filters.store) },
        };
      }
    }

    const rows = await prisma.product.findMany({
      where: queryWhere,
      include: {
        store: true,
        inventoryItem: true,
        pricingRule: true,
      },
      orderBy: { expiryDateTime: "asc" },
    });

    const evaluatedProducts: MarketplaceProductDTO[] = [];

    for (const row of rows) {
      const productDomain = ProductRepository.toDomain(row);
      const inventoryDomain = row.inventoryItem
        ? new InventoryItem({
            inventoryId: row.inventoryItem.inventoryId,
            quantity: row.inventoryItem.quantity,
            reservedQuantity: row.inventoryItem.reservedQuantity,
            productId: row.inventoryItem.productId,
          })
        : null;

      // Step 2: getProductDetails() Marketplace -> Product
      await trace.step({
        correlationId,
        stepNumber: 2,
        label: "getProductDetails()",
        from: "Marketplace",
        to: "Product",
        details: { productId: productDomain.productId },
      });

      // Step 3: productDetails Product -> Marketplace
      const details = productDomain.getDetails();
      await trace.step({
        correlationId,
        stepNumber: 3,
        label: "productDetails",
        from: "Product",
        to: "Marketplace",
        details,
      });

      // Step 4: checkAvailability() Product -> InventoryItem
      await trace.step({
        correlationId,
        stepNumber: 4,
        label: "checkAvailability()",
        from: "Product",
        to: "InventoryItem",
        details: { productId: productDomain.productId },
      });

      const availability = inventoryDomain
        ? inventoryDomain.checkAvailability(1)
        : { available: 0, stockStatus: "OUT_OF_STOCK" as const, isAvailable: false };

      // Alt branch 46 -> 48: stockUnavailable
      if (!availability.isAvailable || availability.available <= 0) {
        await trace.step({
          correlationId,
          stepNumber: 46,
          label: "stockUnavailable",
          from: "InventoryItem",
          to: "Product",
          details: {
            productId: productDomain.productId,
            available: availability.available,
          },
        });

        await trace.step({
          correlationId,
          stepNumber: 47,
          label: "productUnavailable()",
          from: "Product",
          to: "Marketplace",
          details: { productId: productDomain.productId, reason: "No stock available" },
        });

        await trace.step({
          correlationId,
          stepNumber: 48,
          label: "productUnavailable()",
          from: "Marketplace",
          to: "Customer",
          details: { productId: productDomain.productId, excluded: true },
        });

        // Exclude out of stock
        continue;
      }

      // Step 5: stockStatus InventoryItem -> Product
      await trace.step({
        correlationId,
        stepNumber: 5,
        label: "stockStatus",
        from: "InventoryItem",
        to: "Product",
        details: {
          stockStatus: availability.stockStatus,
          available: availability.available,
        },
      });

      // Step 6: calculateCurrentPrice(Product) Marketplace -> PricingEngine
      await trace.step({
        correlationId,
        stepNumber: 6,
        label: "calculateCurrentPrice(Product)",
        from: "Marketplace",
        to: "PricingEngine",
        details: {
          productId: productDomain.productId,
          originalPrice: productDomain.originalPrice,
        },
      });

      const ruleDomain = row.pricingRule
        ? PricingRuleRepository.toDomain(row.pricingRule)
        : undefined;

      const previousPrice = productDomain.currentPrice;

      // Runs Steps 7 through 13 inside PricingEngine
      const computedPrice = await this.pricingEngine.calculatePriceWithTrace(
        productDomain,
        ruleDomain,
        now,
        { correlationId }
      );

      // Persist price change if updated
      if (previousPrice !== computedPrice) {
        await ProductRepository.updatePrice(
          productDomain.productId,
          computedPrice,
          "SEARCH_EVALUATION"
        );
      }

      // Step 14: displayProductAndPrice() Marketplace -> Customer
      await trace.step({
        correlationId,
        stepNumber: 14,
        label: "displayProductAndPrice()",
        from: "Marketplace",
        to: "Customer",
        details: {
          productId: productDomain.productId,
          price: computedPrice,
          originalPrice: productDomain.originalPrice,
        },
      });

      const hoursRemaining = Math.max(
        0,
        Number(
          (
            (productDomain.expiryDateTime.getTime() - now.getTime()) /
            (1000 * 60 * 60)
          ).toFixed(1)
        )
      );

      const discountPercent =
        productDomain.originalPrice > 0
          ? Math.round(
              ((productDomain.originalPrice - computedPrice) /
                productDomain.originalPrice) *
                100
            )
          : 0;

      const expiryBand = getExpiryBand(productDomain.expiryDateTime, now);

      const nextHourMs =
        Math.ceil(now.getTime() / (3600 * 1000)) * (3600 * 1000);

      evaluatedProducts.push({
        id: productDomain.productId,
        name: productDomain.name,
        category: productDomain.category,
        store: {
          id: row.store.storeId,
          name: row.store.storeName,
          address: row.store.address,
        },
        originalPrice: productDomain.originalPrice,
        currentPrice: computedPrice,
        discountPercent,
        hoursRemaining,
        expiryDateTime: productDomain.expiryDateTime.toISOString(),
        expiryBand,
        availableQuantity: availability.available,
        nextPriceUpdateAt: new Date(nextHourMs).toISOString(),
      });
    }

    // Apply post-evaluation filters (Band, MaxPrice, MinDiscount)
    let filtered = evaluatedProducts;

    if (filters.band) {
      filtered = filtered.filter((p) => p.expiryBand === filters.band);
    }

    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      filtered = filtered.filter((p) => p.currentPrice <= filters.maxPrice!);
    }

    if (filters.minDiscount !== undefined && filters.minDiscount > 0) {
      filtered = filtered.filter((p) => p.discountPercent >= filters.minDiscount!);
    }

    // Sorts: highest discount, lowest price, nearest expiry
    if (filters.sort === "discount_desc") {
      filtered.sort((a, b) => b.discountPercent - a.discountPercent);
    } else if (filters.sort === "price_asc") {
      filtered.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (filters.sort === "expiry_asc") {
      filtered.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
    }

    return {
      products: filtered,
      total: filtered.length,
      correlationId,
    };
  }

  /**
   * Retrieves single product by ID with full details, band, and price history.
   */
  async getProductById(productId: number): Promise<{
    product: MarketplaceProductDTO & {
      priceHistories: Array<{
        historyId: number;
        price: number;
        calculatedAt: string;
        reason: string | null;
      }>;
    };
  } | null> {
    const now = clock.now();
    const row = await prisma.product.findUnique({
      where: { productId },
      include: {
        store: true,
        inventoryItem: true,
        pricingRule: true,
        priceHistories: {
          orderBy: { calculatedAt: "desc" },
          take: 20,
        },
      },
    });

    if (!row) return null;

    const productDomain = ProductRepository.toDomain(row);
    const ruleDomain = row.pricingRule
      ? PricingRuleRepository.toDomain(row.pricingRule)
      : undefined;

    // Fresh price recalculation
    const currentPrice = this.pricingEngine.calculatePrice(
      productDomain,
      ruleDomain,
      now
    );

    const hoursRemaining = Math.max(
      0,
      Number(
        (
          (productDomain.expiryDateTime.getTime() - now.getTime()) /
          (1000 * 60 * 60)
        ).toFixed(1)
      )
    );

    const discountPercent =
      productDomain.originalPrice > 0
        ? Math.round(
            ((productDomain.originalPrice - currentPrice) /
              productDomain.originalPrice) *
              100
          )
        : 0;

    const availableQuantity = row.inventoryItem
      ? Math.max(
          0,
          row.inventoryItem.quantity - row.inventoryItem.reservedQuantity
        )
      : 0;

    const nextHourMs =
      Math.ceil(now.getTime() / (3600 * 1000)) * (3600 * 1000);

    return {
      product: {
        id: productDomain.productId,
        name: productDomain.name,
        category: productDomain.category,
        store: {
          id: row.store.storeId,
          name: row.store.storeName,
          address: row.store.address,
        },
        originalPrice: productDomain.originalPrice,
        currentPrice,
        discountPercent,
        hoursRemaining,
        expiryDateTime: productDomain.expiryDateTime.toISOString(),
        expiryBand: getExpiryBand(productDomain.expiryDateTime, now),
        availableQuantity,
        nextPriceUpdateAt: new Date(nextHourMs).toISOString(),
        priceHistories: row.priceHistories.map((h) => ({
          historyId: h.historyId,
          price: h.price,
          calculatedAt: h.calculatedAt.toISOString(),
          reason: h.reason,
        })),
      },
    };
  }
}

export const marketplaceService = new MarketplaceService();
