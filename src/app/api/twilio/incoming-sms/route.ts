import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyTwilioWebhook } from "@/lib/twilio";
import { normalizePhoneForStorage } from "@/lib/utils";

const STOP_KEYWORDS = ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT"];
const START_KEYWORDS = ["START", "UNSTOP", "YES"];

export async function POST(req: NextRequest) {
  try {
    // Validate Twilio webhook signature
    const isValid = await verifyTwilioWebhook(req);
    if (!isValid) {
      console.warn("Invalid Twilio signature on /api/twilio/incoming-sms");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const body = (formData.get("Body") as string || "").trim().toUpperCase();
    const from = formData.get("From") as string || "";

    if (!from) {
      // Return empty TwiML
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response/>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const normalizedPhone = normalizePhoneForStorage(from);
    const last10 = normalizedPhone.slice(-10);

    if (STOP_KEYWORDS.includes(body)) {
      // Opt out: set smsConsent = false on all matching customers
      await prisma.customer.updateMany({
        where: { phone: { endsWith: last10 } },
        data: { smsConsent: false },
      });
      console.log(`SMS opt-out processed for phone ending in ${last10}`);
    } else if (START_KEYWORDS.includes(body)) {
      // Opt in: set smsConsent = true on all matching customers
      await prisma.customer.updateMany({
        where: { phone: { endsWith: last10 } },
        data: { smsConsent: true },
      });
      console.log(`SMS opt-in processed for phone ending in ${last10}`);
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
