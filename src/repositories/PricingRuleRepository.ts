import { prisma } from "@/lib/prisma";
import { PricingRule } from "@/domain/PricingRule";

export class PricingRuleRepository {
  static toDomain(row: {
    ruleId: number;
    discountRate: number;
    expiryThresholdHours: number;
    maximumDiscount: number;
    minimumPriceFloor: number;
    category: string | null;
    storeId: number | null;
  }): PricingRule {
    return new PricingRule({
      ruleId: row.ruleId,
      discountRate: row.discountRate,
      expiryThresholdHours: row.expiryThresholdHours,
      maximumDiscount: row.maximumDiscount,
      minimumPriceFloor: row.minimumPriceFloor,
      category: row.category ?? undefined,
      storeId: row.storeId ?? undefined,
    });
  }

  static async findById(ruleId: number): Promise<PricingRule | null> {
    const row = await prisma.pricingRule.findUnique({ where: { ruleId } });
    return row ? this.toDomain(row) : null;
  }

  static async findByCategory(category: string): Promise<PricingRule | null> {
    const row = await prisma.pricingRule.findFirst({
      where: { category },
    });
    return row ? this.toDomain(row) : null;
  }

  static async findAll(): Promise<PricingRule[]> {
    const rows = await prisma.pricingRule.findMany();
    return rows.map((r) => this.toDomain(r));
  }
}
