import { NextRequest, NextResponse } from "next/server";
import { clock } from "@/lib/clock";

export async function GET() {
  return NextResponse.json({
    now: clock.now().toISOString(),
    offsetMs: clock.getOffsetMs(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "advance" && typeof body.hours === "number") {
      clock.advanceHours(body.hours);
    } else if (body.action === "reset") {
      clock.reset();
    }
    return NextResponse.json({
      success: true,
      now: clock.now().toISOString(),
      offsetMs: clock.getOffsetMs(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
