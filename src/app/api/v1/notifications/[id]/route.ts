import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { notificationService } from "@/services/NotificationService";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const notificationId = parseInt(params.id, 10);
    if (isNaN(notificationId)) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }

    const result = await notificationService.markAsRead(notificationId, session.userId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[PATCH /api/v1/notifications/:id] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark notification as read" },
      { status: 400 }
    );
  }
}
