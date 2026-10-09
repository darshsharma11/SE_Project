import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const traces = await prisma.traceLog.findMany({
      orderBy: [{ timestamp: "desc" }, { stepNumber: "asc" }],
      take: 200,
    });

    // Group traces by correlationId
    const grouped: Record<string, typeof traces> = {};
    for (const item of traces) {
      if (!grouped[item.correlationId]) {
        grouped[item.correlationId] = [];
      }
      grouped[item.correlationId].push(item);
    }

    return NextResponse.json({
      success: true,
      traces,
      grouped,
    });
  } catch (error) {
    console.error("Error fetching traces:", error);
    return NextResponse.json({ error: "Failed to fetch trace logs" }, { status: 500 });
  }
}
