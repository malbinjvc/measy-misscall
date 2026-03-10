import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTwilioClient } from "@/lib/twilio";
import { getBaseUrl } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { purchaseNumberSchema } from "@/lib/validations";

// Canadian province/territory full name → 2-letter code
const CA_PROVINCE_CODES: Record<string, string> = {
  "alberta": "AB",
  "british columbia": "BC",
  "manitoba": "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "newfoundland": "NL",
  "northwest territories": "NT",
  "nova scotia": "NS",
  "nunavut": "NU",
  "ontario": "ON",
  "prince edward island": "PE",
  "quebec": "QC",
  "québec": "QC",
  "saskatchewan": "SK",
  "yukon": "YT",
};

/** Convert province name to 2-letter code. Returns as-is if already a code or unrecognized. */
function toProvinceCode(state: string): string {
  const trimmed = state.trim();
  // Already a 2-letter code
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return CA_PROVINCE_CODES[trimmed.toLowerCase()] || trimmed;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 searches per tenant per minute
    const limit = checkRateLimit(`twilio-search:${session.user.tenantId}`, { max: 10, windowSec: 60 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many search requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { city: true, state: true, zipCode: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const client = await getTwilioClient();
    const regionCode = tenant.state ? toProvinceCode(tenant.state) : null;

    // Search for available Canadian local numbers near the tenant's location
    const searchParams: Record<string, string | number> = { limit: 10 };

    if (tenant.city) {
      searchParams.inLocality = tenant.city;
    }
    if (regionCode) {
      searchParams.inRegion = regionCode;
    }

    let numbers = await client.availablePhoneNumbers("CA").local.list(searchParams);

    // Fallback: if no results with locality, try just region
    if (numbers.length === 0 && tenant.city) {
      delete searchParams.inLocality;
      numbers = await client.availablePhoneNumbers("CA").local.list(searchParams);
    }

    // Fallback: if still no results with region, broaden to any CA number
    if (numbers.length === 0) {
      numbers = await client.availablePhoneNumbers("CA").local.list({ limit: 10 });
    }

    const available = numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      capabilities: {
        voice: n.capabilities.voice,
        sms: n.capabilities.sms,
      },
    }));

    return NextResponse.json({ success: true, data: available });
  } catch (error: unknown) {
    console.error("Available numbers search error:", error);
    const message = "Failed to search numbers";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    // Rate limit: 3 purchase attempts per tenant per hour
    const purchaseLimit = checkRateLimit(`twilio-purchase:${tenantId}`, { max: 3, windowSec: 3600 });
    if (!purchaseLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many purchase attempts. Please try again later." },
        { status: 429 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { assignedTwilioNumber: true, status: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    // Only allow purchase for ACTIVE tenants (pay first, then set up phone)
    if (tenant.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Complete onboarding and subscribe before setting up a phone number" },
        { status: 403 }
      );
    }

    if (tenant.assignedTwilioNumber) {
      return NextResponse.json(
        { success: false, error: "You already have an assigned phone number" },
        { status: 400 }
      );
    }

    const { phoneNumber } = purchaseNumberSchema.parse(await req.json());

    const client = await getTwilioClient();

    // Purchase the number
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: `${getBaseUrl()}/api/twilio/voice`,
      voiceMethod: "POST",
      statusCallback: `${getBaseUrl()}/api/twilio/call-status`,
      statusCallbackMethod: "POST",
      smsUrl: `${getBaseUrl()}/api/twilio/sms-status`,
      smsMethod: "POST",
    });

    // Save to tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { assignedTwilioNumber: purchased.phoneNumber },
    });

    return NextResponse.json({
      success: true,
      data: { phoneNumber: purchased.phoneNumber, sid: purchased.sid },
    });
  } catch (error: unknown) {
    console.error("Number purchase error:", error);
    const message = "Failed to purchase number";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
