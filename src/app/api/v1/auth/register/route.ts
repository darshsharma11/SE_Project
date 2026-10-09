import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signSessionToken, AUTH_COOKIE_NAME, UserSessionPayload } from "@/lib/auth";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  deliveryAddress: z.string().min(5, "Delivery address is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = RegisterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.errors }, { status: 400 });
    }

    const { name, email, phone, password, deliveryAddress } = result.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: "CUSTOMER",
        },
      });

      await tx.customer.create({
        data: {
          customerId: user.userId,
          deliveryAddress,
        },
      });

      await tx.shoppingCart.create({
        data: {
          customerId: user.userId,
          totalAmount: 0,
        },
      });

      return user;
    });

    const payload: UserSessionPayload = {
      userId: newUser.userId,
      email: newUser.email,
      name: newUser.name,
      role: "CUSTOMER",
    };

    const token = await signSessionToken(payload);

    const res = NextResponse.json({
      success: true,
      user: {
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        role: "CUSTOMER",
      },
    });

    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });

    return res;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
