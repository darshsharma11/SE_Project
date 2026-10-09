import { prisma } from "@/lib/prisma";
import { clock } from "@/lib/clock";
import { PricingEngine } from "@/domain/PricingEngine";
import { ProductRepository } from "@/repositories/ProductRepository";
import { PricingRuleRepository } from "@/repositories/PricingRuleRepository";

export interface PricingJobResult {
  success: boolean;
  timestamp: string;
  updatedCount: number;
  expiredCount: number;
  updatedProducts: Array<{
    productId: number;
    name: string;
    previousPrice: number;
    newPrice: number;
  }>;
  expiredProducts: Array<{
    productId: number;
    name: string;
  }>;
}

const pricingEngine = new PricingEngine();

export async function runPricingJob(): Promise<PricingJobResult> {
  const now = clock.now();
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      pricingRule: true,
      store: true,
    },
  });

  const updatedProducts: Array<{
    productId: number;
    name: string;
    previousPrice: number;
    newPrice: number;
  }> = [];

  const expiredProducts: Array<{
    productId: number;
    name: string;
  }> = [];

  for (const row of products) {
    const productDomain = ProductRepository.toDomain(row);

    // 1. Check expiration
    if (productDomain.expiryDateTime.getTime() <= now.getTime()) {
      productDomain.transitionStatus("EXPIRED_REMOVED");
      await prisma.product.update({
        where: { productId: productDomain.productId },
        data: { status: "EXPIRED_REMOVED" },
      });
      expiredProducts.push({
        productId: productDomain.productId,
        name: productDomain.name,
      });
      continue;
    }

    // 2. Dynamic decay calculation
    const ruleDomain = row.pricingRule
      ? PricingRuleRepository.toDomain(row.pricingRule)
      : undefined;

    const previousPrice = productDomain.currentPrice;
    const computedPrice = pricingEngine.calculatePrice(
      productDomain,
      ruleDomain,
      now
    );

    if (previousPrice !== computedPrice) {
      await ProductRepository.updatePrice(
        productDomain.productId,
        computedPrice,
        "HOURLY_DECAY"
      );

      updatedProducts.push({
        productId: productDomain.productId,
        name: productDomain.name,
        previousPrice,
        newPrice: computedPrice,
      });
    }
  }

  return {
    success: true,
    timestamp: now.toISOString(),
    updatedCount: updatedProducts.length,
    expiredCount: expiredProducts.length,
    updatedProducts,
    expiredProducts,
  };
}

// In-process scheduler state
declare global {
  // eslint-disable-next-line no-var
  var __pricingSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (global.__pricingSchedulerStarted) {
    return;
  }
  global.__pricingSchedulerStarted = true;

  // Run hourly job (3600000 ms)
  setInterval(async () => {
    try {
      await runPricingJob();
    } catch (err) {
      console.error("[Scheduler] Hourly pricing job failed:", err);
    }
  }, 60 * 60 * 1000);
}

// Auto-start on load in Node server environment
if (typeof window === "undefined") {
  startScheduler();
}
