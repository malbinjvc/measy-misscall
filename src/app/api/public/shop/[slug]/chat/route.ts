import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      include: {
        services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        businessHours: { orderBy: { day: "asc" } },
        subscription: { include: { plan: true } },
      },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    // Check subscription eligibility (Professional+ = sortOrder >= 2)
    const hasAiChat = tenant.subscription?.plan
      ? tenant.subscription.plan.sortOrder >= 2
      : false;

    if (!hasAiChat) {
      return NextResponse.json(
        { success: false, error: "AI chat is not available for this business" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const message = (body.message || "").trim().toLowerCase();

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const reply = generateReply(message, tenant);

    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

function generateReply(message: string, tenant: any): string {
  const slug = tenant.slug;
  const bookingUrl = `/shop/${slug}/book`;

  // Hours keywords
  if (message.match(/\b(hour|hours|open|close|time|schedule|when)\b/)) {
    const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const hoursLines = dayOrder.map((day) => {
      const h = tenant.businessHours.find((bh: any) => bh.day === day);
      const dayName = day.charAt(0) + day.slice(1).toLowerCase();
      if (!h || !h.isOpen) return `${dayName}: Closed`;
      return `${dayName}: ${h.openTime} - ${h.closeTime}`;
    });
    return `Here are our business hours:\n\n${hoursLines.join("\n")}`;
  }

  // Services keywords
  if (message.match(/\b(service|services|offer|offering|what do you do|price|pricing|cost|how much)\b/)) {
    if (tenant.services.length === 0) {
      return "We currently don't have any services listed. Please contact us directly for more information.";
    }
    const serviceLines = tenant.services.map((s: any) => {
      const price = s.price ? `$${s.price}` : "Contact for pricing";
      return `- ${s.name} (${s.duration} min) — ${price}`;
    });
    return `Here are our services:\n\n${serviceLines.join("\n")}\n\nWould you like to book an appointment?`;
  }

  // Booking keywords
  if (message.match(/\b(book|booking|appointment|schedule|reserve)\b/)) {
    return `You can book an appointment online here: ${bookingUrl}\n\nJust pick a service, choose a date and time, and we'll confirm your booking!`;
  }

  // Contact keywords
  if (message.match(/\b(contact|phone|call|reach|address|location|where|find)\b/)) {
    const parts = [];
    if (tenant.phone) parts.push(`Phone: ${tenant.phone}`);
    if (tenant.address) {
      let addr = tenant.address;
      if (tenant.city) addr += `, ${tenant.city}`;
      if (tenant.state) addr += `, ${tenant.state}`;
      if (tenant.zipCode) addr += ` ${tenant.zipCode}`;
      parts.push(`Address: ${addr}`);
    }
    return parts.length > 0
      ? `Here's how to reach us:\n\n${parts.join("\n")}`
      : "Please check our shop page for contact details.";
  }

  // Greeting
  if (message.match(/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/)) {
    return `Hello! Welcome to ${tenant.name}. How can I help you today? You can ask about our services, business hours, booking, or contact information.`;
  }

  // Thank you
  if (message.match(/\b(thank|thanks|thx)\b/)) {
    return "You're welcome! Is there anything else I can help you with?";
  }

  // Default
  return `I can help you with information about:\n\n- Our **services** and pricing\n- **Business hours**\n- **Booking** an appointment\n- **Contact** information\n\nJust ask me about any of these topics!`;
}
