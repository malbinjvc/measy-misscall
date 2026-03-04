import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "customer_token";
const TOKEN_EXPIRY = "24h";

interface CustomerTokenPayload {
  customerId: string;
  tenantId: string;
  phone: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.CUSTOMER_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("CUSTOMER_JWT_SECRET or NEXTAUTH_SECRET must be set");
  // Derive a consistent 32-byte key
  return new Uint8Array(crypto.createHash("sha256").update(secret).digest());
}

export async function signCustomerToken(payload: CustomerTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyCustomerToken(token: string): Promise<CustomerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as CustomerTokenPayload;
  } catch {
    return null;
  }
}

export function setCustomerCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
}

export function clearCustomerCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getCustomerFromRequest(req: NextRequest): Promise<CustomerTokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyCustomerToken(token);
}
