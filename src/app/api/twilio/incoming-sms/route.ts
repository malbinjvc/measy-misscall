import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";
import { normalizePhoneForStorage } from "@/lib/utils";

const STOP_KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT"];
const START_KEYWORDS = ["START", "UNSTOP", "YES"];

export async function POST(req: NextRequest) {
  try {
    // Parse form data once — reuse for verification and data extraction
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });

    const signature = req.headers.get("x-twilio-signature");
    if (!signature) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const internalUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || internalUrl.origin;
    const url = baseUrl + internalUrl.pathname + internalUrl.search;

    const isValid = await validateTwilioSignature(signature, url, params);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/incoming-sms");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (params.Body || "").trim().toUpperCase();
    const from = params.From || "";

    if (!from) {
      // Return empty TwiML
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response/>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const normalizedPhone = normalizePhoneForStorage(from);

    // Identify which tenant this SMS belongs to via the Twilio number it was sent TO
    const toNumber = params.To || "";
    const tenant = toNumber
      ? await prisma.tenant.findFirst({
          where: { assignedTwilioNumber: toNumber },
          select: { id: true },
        })
      : null;

    if (tenant && STOP_KEYWORDS.includes(body)) {
      // Opt out: scoped to tenant for isolation, exact phone match for performance
      await prisma.customer.updateMany({
        where: { phone: normalizedPhone, tenantId: tenant.id },
        data: { smsConsent: false },
      });
      console.log(`SMS opt-out processed for ${normalizedPhone} (tenant ${tenant.id})`);
    } else if (tenant && START_KEYWORDS.includes(body)) {
      // Opt in: scoped to tenant for isolation, exact phone match for performance
      await prisma.customer.updateMany({
        where: { phone: normalizedPhone, tenantId: tenant.id },
        data: { smsConsent: true },
      });
      console.log(`SMS opt-in processed for ${normalizedPhone} (tenant ${tenant.id})`);
    } else if (!tenant && (STOP_KEYWORDS.includes(body) || START_KEYWORDS.includes(body))) {
      console.warn(`SMS consent keyword from ${normalizedPhone} but no tenant found for Twilio number ${toNumber}`);
    }

    // Return empty TwiML response (Twilio handles STOP at carrier level for US/CA)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response/>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Incoming SMS webhook error:", error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response/>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
