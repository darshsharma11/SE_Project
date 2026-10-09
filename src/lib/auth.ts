import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-key-for-development-expiry-marketplace"
);

export const AUTH_COOKIE_NAME = "auth_token";

export interface UserSessionPayload {
  userId: number;
  email: string;
  name: string;
  role: "CUSTOMER" | "STORE_OWNER" | "DELIVERY_PARTNER" | "ADMIN";
}

/**
 * Hash a plain password.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare plain password with hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign JWT token for user session.
 */
export async function signSessionToken(payload: UserSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

/**
 * Verify JWT token string.
 */
export async function verifySessionToken(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: Number(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as UserSessionPayload["role"],
    };
  } catch {
    return null;
  }
}

/**
 * Get current session from incoming cookies.
 */
export async function getSession(): Promise<UserSessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Require a logged-in user with specific roles, throwing an error or returning null.
 */
export async function requireAuth(allowedRoles?: string[]): Promise<UserSessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    throw new Error(`FORBIDDEN: Requires one of [${allowedRoles.join(", ")}]`);
  }

  return session;
}

/**
 * Verify store ownership. Throws if user does not own the store (and is not ADMIN).
 */
export async function checkStoreOwnership(userId: number, storeId: number): Promise<boolean> {
  const store = await prisma.store.findUnique({
    where: { storeId },
    select: { ownerId: true },
  });
  if (!store) return false;
  return store.ownerId === userId;
}
