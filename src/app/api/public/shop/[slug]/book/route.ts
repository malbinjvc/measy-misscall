import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAppointmentSchema } from "@/lib/validations";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createAppointmentSchema.parse(body);

    // Verify service belongs to tenant
    const service = await prisma.service.findFirst({
      where: { id: validated.serviceId, tenantId: tenant.id, isActive: true },
    });

    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    // Calculate end time
    const [hours, minutes] = validated.startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + service.duration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const appointment = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        serviceId: validated.serviceId,
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail || null,
        date: new Date(validated.date),
        startTime: validated.startTime,
        endTime,
        notes: validated.notes || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: appointment });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Booking error:", error);
    return NextResponse.json({ success: false, error: "Booking failed" }, { status: 500 });
  }
}
