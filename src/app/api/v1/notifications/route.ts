import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { notificationService } from "@/services/NotificationService";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { notifications, unreadCount } = await notificationService.getNotificationsForUser(
      session.userId
    );

    return NextResponse.json({ success: true, data: notifications, unreadCount });
  } catch (error: any) {
    console.error("[GET /api/v1/notifications] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Mark all as read
    const result = await notificationService.markAllAsRead(session.userId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[PATCH /api/v1/notifications] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
