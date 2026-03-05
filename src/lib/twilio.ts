import twilio from "twilio";
import prisma from "./prisma";
import { decrypt, isEncrypted } from "./crypto";

// Cached credentials to avoid DB query on every call
let cachedSid: string | null = null;
let cachedToken: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Load Twilio credentials from PlatformSettings DB, falling back to env vars.
 */
async function getTwilioCredentials(): Promise<{ sid: string; token: string }> {
  const now = Date.now();

  if (cachedSid && cachedToken && now - cacheTimestamp < CACHE_TTL_MS) {
    return { sid: cachedSid, token: cachedToken };
  }

  // Try DB first (PlatformSettings — managed by super admin)
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform-settings" },
    select: { sharedTwilioSid: true, sharedTwilioToken: true },
  });

  const sid = settings?.sharedTwilioSid || process.env.TWILIO_ACCOUNT_SID;
  // Decrypt the token if it was encrypted at rest
  let dbToken = settings?.sharedTwilioToken || null;
  if (dbToken && isEncrypted(dbToken)) {
    try { dbToken = decrypt(dbToken); } catch { /* fall through to env var */ dbToken = null; }
  }
  const token = dbToken || process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error("Twilio credentials not configured. Ask your admin to connect a Twilio account in Platform Settings.");
  }

  cachedSid = sid;
  cachedToken = token;
  cacheTimestamp = now;

  return { sid, token };
}

// Get Twilio client — reads credentials from DB (super admin) or env vars
export async function getTwilioClient() {
  const { sid, token } = await getTwilioCredentials();
  return twilio(sid, token);
}

// Validate Twilio webhook signature
export async function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  const { token } = await getTwilioCredentials();
  return twilio.validateRequest(token, signature, url, params);
}

// Test Twilio connection with provided credentials (used by admin settings)
export async function testTwilioConnection(
  sid: string,
  token: string
): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const client = twilio(sid, token);
    const account = await client.api.accounts(sid).fetch();
    return { success: true, accountName: account.friendlyName };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid credentials";
    return { success: false, error: message };
  }
}

/**
 * Verify an incoming Twilio webhook request.
 * Extracts the signature header and form params, validates against our auth token.
 * Returns true if valid, false otherwise.
 */
export async function verifyTwilioWebhook(req: Request): Promise<boolean> {
  try {
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) return false;

    // Build the full URL Twilio used to sign the request.
    // req.url returns the internal URL (e.g. http://localhost:3000/...) but
    // Twilio signs using the public URL (e.g. https://xyz.ngrok-free.dev/...).
    // Use NEXT_PUBLIC_APP_URL + pathname to reconstruct the public URL.
    const internalUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || internalUrl.origin;
    const url = baseUrl + internalUrl.pathname + internalUrl.search;

    // Parse form data into a plain object for validation
    const clonedReq = req.clone();
    const formData = await clonedReq.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    return await validateTwilioSignature(signature, url, params);
  } catch (error) {
    console.error("Twilio webhook verification error:", error);
    return false;
  }
}

/** Clear cached credentials (call after admin updates settings) */
export function clearTwilioCache() {
  cachedSid = null;
  cachedToken = null;
  cacheTimestamp = 0;
}
