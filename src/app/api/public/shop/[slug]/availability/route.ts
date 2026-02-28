import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const date = req.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ success: false, error: "Date parameter required" }, { status: 400 });
    }

    // Get day of week from date — parse directly to avoid timezone issues
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day); // local date, no UTC shift
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const dayOfWeek = days[dateObj.getDay()];

    // Get business hours for that day
    const businessHours = await prisma.businessHours.findUnique({
      where: { tenantId_day: { tenantId: tenant.id, day: dayOfWeek as any } },
    });

    if (!businessHours || !businessHours.isOpen) {
      return NextResponse.json({
        success: true,
        data: { isOpen: false, openTime: null, closeTime: null, bookedSlots: [] },
      });
    }

    // Get all non-cancelled appointments for this date
    const startOfDay = new Date(date + "T00:00:00.000Z");
    const endOfDay = new Date(date + "T23:59:59.999Z");

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        date: { gte: startOfDay, lte: endOfDay },
        status: { not: "CANCELLED" },
      },
      select: { startTime: true, endTime: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        isOpen: true,
        openTime: businessHours.openTime,
        closeTime: businessHours.closeTime,
        bookedSlots: appointments.map((a) => ({
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      },
    });
  } catch (error) {
    console.error("Availability check error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
