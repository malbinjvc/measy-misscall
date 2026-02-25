import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createComplaintSchema } from "@/lib/validations";
import { generateReferenceNumber } from "@/lib/utils";

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
    const validated = createComplaintSchema.parse(body);

    const referenceNumber = generateReferenceNumber();

    const complaint = await prisma.complaint.create({
      data: {
        tenantId: tenant.id,
        callId: validated.callId || null,
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail || null,
        category: validated.category,
        description: validated.description,
        referenceNumber,
        status: "OPEN",
      },
    });

    return NextResponse.json({ success: true, data: { id: complaint.id, referenceNumber: complaint.referenceNumber } });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Complaint error:", error);
    return NextResponse.json({ success: false, error: "Submission failed" }, { status: 500 });
  }
}
