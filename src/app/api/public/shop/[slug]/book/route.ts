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

    // If serviceOptionId is provided, verify it belongs to the service and is active
    let duration = service.duration;
    let serviceOptionId: string | null = null;
    let quantity = validated.quantity ?? 1;
    let selectedSubOptions: string[] = [];

    if (validated.serviceOptionId) {
      const option = await prisma.serviceOption.findFirst({
        where: {
          id: validated.serviceOptionId,
          serviceId: service.id,
          isActive: true,
        },
        include: { subOptions: { where: { isActive: true } } },
      });
      if (!option) {
        return NextResponse.json({ success: false, error: "Service option not found" }, { status: 404 });
      }
      // Use option's duration if set, otherwise fall back to service duration
      if (option.duration) {
        duration = option.duration;
      }
      serviceOptionId = option.id;

      // Validate quantity against option's min/max
      if (quantity < option.minQuantity) quantity = option.minQuantity;
      if (quantity > option.maxQuantity) quantity = option.maxQuantity;

      // Validate sub-option IDs belong to the selected option and are active
      if (validated.selectedSubOptionIds?.length) {
        const validSubIds = option.subOptions.map((s) => s.id);
        for (const subId of validated.selectedSubOptionIds) {
          if (!validSubIds.includes(subId)) {
            return NextResponse.json({ success: false, error: "Invalid sub-option selected" }, { status: 400 });
          }
        }
        selectedSubOptions = validated.selectedSubOptionIds;
      }
    }

    // Duration multiplied by quantity
    const totalDuration = duration * quantity;

    // Calculate end time
    const [hours, minutes] = validated.startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const appointment = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        serviceId: validated.serviceId,
        serviceOptionId,
        quantity,
        selectedSubOptions,
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
