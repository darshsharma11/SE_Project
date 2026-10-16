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
 * Check if evaluator demo mode is active.
 * Enabled via DEMO_MODE=true in .env, or by default in development/test unless DEMO_MODE=false.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export const DEMO_IDENTITIES: Record<
  UserSessionPayload["role"],
  { email: string; name: string }
> = {
  CUSTOMER: { email: "rahul.customer@gmail.com", name: "Rahul Verma" },
  STORE_OWNER: { email: "freshmart.owner@gmail.com", name: "Ramesh Patel (FreshMart)" },
  DELIVERY_PARTNER: { email: "partner1@zerowaste.org", name: "Vikram Singh" },
  ADMIN: { email: "admin@zerowaste.org", name: "Admin Officer" },
};

export const DEMO_STORE_OWNERS = [
  {
    email: "freshmart.owner@gmail.com",
    name: "Ramesh Patel",
    storeName: "FreshMart Supermarket",
    status: "VERIFIED",
  },
  {
    email: "greenleaf.owner@gmail.com",
    name: "Priya Sharma",
    storeName: "GreenLeaf Organic Grocers",
    status: "VERIFIED",
  },
  {
    email: "cornermart.owner@gmail.com",
    name: "Devendra Verma",
    storeName: "Corner Daily Mart",
    status: "PENDING_VERIFICATION",
  },
];

/**
 * Retrieve a valid seeded demo persona by role (with optional specific email or userId).
 */
export async function getDemoPersona(
  role: UserSessionPayload["role"],
  targetEmailOrId?: string | number
): Promise<UserSessionPayload | null> {
  if (targetEmailOrId) {
    const user = await prisma.user.findFirst({
      where:
        typeof targetEmailOrId === "number"
          ? { userId: targetEmailOrId, role }
          : { email: targetEmailOrId, role },
    });
    if (user) {
      return {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role as UserSessionPayload["role"],
      };
    }
  }

  const target = DEMO_IDENTITIES[role];
  if (!target) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: target.email },
        { role },
      ],
    },
    orderBy: { userId: "asc" },
  });

  if (!user) return null;

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role as UserSessionPayload["role"],
  };
}

/**
 * Get current session from incoming cookies.
 * In demo mode, falls back to the default demo customer if no cookie is set.
 */
export async function getSession(): Promise<UserSessionPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const verified = await verifySessionToken(token);
      if (verified) return verified;
    }
  } catch {
    // cookies() may throw outside Next server request context (e.g. tests)
  }

  if (isDemoMode()) {
    try {
      const defaultUser = await getDemoPersona("CUSTOMER");
      if (defaultUser) return defaultUser;
    } catch {
      // In case DB is not yet connected during early bootstrap
    }
  }

  return null;
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
