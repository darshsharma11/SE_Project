import { NextResponse } from "next/server";
import {
  getSession,
  isDemoMode,
  signSessionToken,
  AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getSession();
  const demoActive = isDemoMode();

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      demoMode: demoActive,
    });
  }

  const response = NextResponse.json({
    authenticated: true,
    user: session,
    demoMode: demoActive,
  });

  // If in demo mode and client has no cookie yet, seed cookie for seamless browsing
  const cookieStore = cookies();
  if (demoActive && !cookieStore.get(AUTH_COOKIE_NAME)?.value) {
    try {
      const token = await signSessionToken(session);
      response.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
      });
    } catch {}
  }

  return response;
}
