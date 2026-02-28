import twilio from "twilio";
import prisma from "./prisma";

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
  const token = settings?.sharedTwilioToken || process.env.TWILIO_AUTH_TOKEN;

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
  } catch (error: any) {
    return { success: false, error: error.message || "Invalid credentials" };
  }
}

/** Clear cached credentials (call after admin updates settings) */
export function clearTwilioCache() {
  cachedSid = null;
  cachedToken = null;
  cacheTimestamp = 0;
}
