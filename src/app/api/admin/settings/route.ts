import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { platformSettingsSchema, testTwilioSchema } from "@/lib/validations";
import { testTwilioConnection, clearTwilioCache } from "@/lib/twilio";
import { getErrorMessage } from "@/lib/errors";
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { clearMaintenanceCache } from "@/lib/maintenance";

const sensitiveFields = ["sharedTwilioToken", "stripeSecretKey", "stripeWebhookSecret", "elevenlabsApiKey"] as const;

/** Mask a secret string, showing only last 4 characters */
function maskSecret(value: string | null): string | null {
  if (!value || value.length <= 4) return value ? "****" : null;
  return "****" + value.slice(-4);
}

/** Decrypt sensitive fields in a settings object */
function decryptSettings<T extends Record<string, unknown>>(settings: T): T {
  const decrypted: Record<string, unknown> = { ...settings };
  for (const field of sensitiveFields) {
    const val = decrypted[field];
    if (val && typeof val === "string" && isEncrypted(val)) {
      try {
        decrypted[field] = decrypt(val);
      } catch {
        /* leave as-is if decryption fails */
      }
    }
  }
  return decrypted as T;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    let settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: "platform-settings" },
      });
    }

    // Decrypt sensitive fields, then mask before sending to client
    const decrypted = decryptSettings(settings);
    const masked = {
      ...decrypted,
      sharedTwilioToken: maskSecret(decrypted.sharedTwilioToken),
      stripeSecretKey: maskSecret(decrypted.stripeSecretKey),
      stripeWebhookSecret: maskSecret(decrypted.stripeWebhookSecret),
      elevenlabsApiKey: maskSecret(decrypted.elevenlabsApiKey),
    };

    return NextResponse.json({ success: true, data: masked });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const validated = platformSettingsSchema.partial().parse(body);

    // Encrypt sensitive fields before saving to DB.
    // Safety: remove any value that is empty, contains "****" (masked placeholder), or looks suspicious.
    // The frontend should only send sensitive fields when the user explicitly typed a new value.
    for (const field of sensitiveFields) {
      const val = (validated as Record<string, unknown>)[field];
      if (val === undefined || val === null) continue;
      if (typeof val === "string") {
        // Remove empty strings and any value containing mask characters
        if (!val.trim() || val.includes("****")) {
          delete (validated as Record<string, unknown>)[field];
        } else if (!isEncrypted(val)) {
          (validated as Record<string, string>)[field] = encrypt(val);
        }
      }
    }

    const settings = await prisma.platformSettings.upsert({
      where: { id: "platform-settings" },
      update: validated,
      create: { id: "platform-settings", ...validated },
    });

    // Clear caches so new settings take effect immediately
    clearTwilioCache();
    clearMaintenanceCache();

    // Decrypt then mask secrets in the response
    const decrypted = decryptSettings(settings);
    const masked = {
      ...decrypted,
      sharedTwilioToken: maskSecret(decrypted.sharedTwilioToken),
      stripeSecretKey: maskSecret(decrypted.stripeSecretKey),
      stripeWebhookSecret: maskSecret(decrypted.stripeWebhookSecret),
      elevenlabsApiKey: maskSecret(decrypted.elevenlabsApiKey),
    };

    return NextResponse.json({ success: true, data: masked });
  } catch (error: unknown) {
    console.error("Admin settings PATCH error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

// Test Twilio connection with provided credentials
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { sid, token } = testTwilioSchema.parse(await req.json());

    const result = await testTwilioConnection(sid, token);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: "Connection test failed" }, { status: 500 });
  }
}
