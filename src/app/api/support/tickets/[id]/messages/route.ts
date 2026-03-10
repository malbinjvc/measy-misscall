import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ticketMessageSchema } from "@/lib/validations";
import { getErrorMessage } from "@/lib/errors";

// Add a message to a ticket (tenant side)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = ticketMessageSchema.parse(body);
    const message = validated.message;
    const attachmentUrls = validated.attachmentUrls || [];
    const attachmentNames = validated.attachmentNames || [];

    // Verify ticket belongs to this tenant
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Ticket is closed" }, { status: 400 });
    }

    // Create message and reopen if resolved
    const [newMessage] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderRole: "TENANT",
          senderName: session.user.name || "Tenant",
          message,
          attachmentUrls,
          attachmentNames,
        },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: {
          status: ticket.status === "RESOLVED" ? "OPEN" : ticket.status,
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Add message error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to send message" }, { status: 500 });
  }
}
