import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateTicketStatusSchema } from "@/lib/validations";
import { getErrorMessage } from "@/lib/errors";

// Get a single ticket with all messages (admin)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        tenant: { select: { name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    // Mark as read by admin (fire-and-forget)
    prisma.supportTicket.update({
      where: { id },
      data: { lastReadByAdmin: new Date() },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Admin get ticket error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to fetch ticket" }, { status: 500 });
  }
}

// Update ticket status (admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = updateTicketStatusSchema.parse(body);

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Admin update ticket error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to update ticket" }, { status: 500 });
  }
}
