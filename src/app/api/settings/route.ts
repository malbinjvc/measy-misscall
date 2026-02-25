import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();
    const { section, ...data } = body;

    switch (section) {
      case "profile": {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            name: data.name,
            slug: data.slug,
            email: data.email,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zipCode: data.zipCode || null,
            description: data.description || null,
          },
        });
        break;
      }

      case "hours": {
        for (const h of data.hours) {
          await prisma.businessHours.upsert({
            where: { tenantId_day: { tenantId, day: h.day } },
            update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
            create: { tenantId, day: h.day, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
          });
        }
        break;
      }

      case "twilio": {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            businessPhoneNumber: data.businessPhoneNumber || null,
            ivrGreeting: data.ivrGreeting || null,
            ivrCallbackMessage: data.ivrCallbackMessage || null,
            ivrComplaintMessage: data.ivrComplaintMessage || null,
          },
        });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid section" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
  }
}
