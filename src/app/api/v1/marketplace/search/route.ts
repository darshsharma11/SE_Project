import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { marketplaceService } from "@/services/MarketplaceService";
import { ExpiryBand } from "@/lib/config";

export const dynamic = "force-dynamic";

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  keyword: z.string().optional(),
  category: z.string().optional(),
  store: z.string().optional(),
  band: z.enum(["CRITICAL", "URGENT", "SOON", "STANDARD"]).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minDiscount: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(["discount_desc", "price_asc", "expiry_asc"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = SearchQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      keyword: searchParams.get("keyword") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      store: searchParams.get("store") ?? undefined,
      band: searchParams.get("band") ?? undefined,
      maxPrice: searchParams.get("maxPrice") ?? undefined,
      minDiscount: searchParams.get("minDiscount") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { q, keyword, category, store, band, maxPrice, minDiscount, sort } =
      parsed.data;
    const searchKeyword = keyword || q || "";

    const result = await marketplaceService.searchProduct(searchKeyword, {
      category,
      store,
      band: band as ExpiryBand | undefined,
      maxPrice,
      minDiscount,
      sort,
    });

    return NextResponse.json({
      success: true,
      data: result.products,
      total: result.total,
      correlationId: result.correlationId,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/marketplace/search] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search marketplace products" },
      { status: 500 }
    );
  }
}
