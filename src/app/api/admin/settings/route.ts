import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { testTwilioConnection, clearTwilioCache } from "@/lib/twilio";

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

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
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

    // Only allow known fields — strip id, createdAt, updatedAt, etc.
    const allowedFields: Record<string, any> = {};
    const allowed = [
      "sharedTwilioSid", "sharedTwilioToken", "sharedTwilioNumber",
      "defaultIvrGreeting", "defaultIvrCallback",
      "stripeSecretKey", "stripePublishableKey", "stripeWebhookSecret",
      "elevenlabsApiKey", "elevenlabsVoiceId",
      "maintenanceMode",
    ];
    for (const key of allowed) {
      if (key in body) allowedFields[key] = body[key];
    }

    const settings = await prisma.platformSettings.upsert({
      where: { id: "platform-settings" },
      update: allowedFields,
      create: { id: "platform-settings", ...allowedFields },
    });

    // Clear cached Twilio client so new credentials take effect
    clearTwilioCache();

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Admin settings PATCH error:", error);
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

    const { sid, token } = await req.json();

    if (!sid || !token) {
      return NextResponse.json(
        { success: false, error: "Account SID and Auth Token are required." },
        { status: 400 }
      );
    }

    const result = await testTwilioConnection(sid, token);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: "Connection test failed" }, { status: 500 });
  }
}
