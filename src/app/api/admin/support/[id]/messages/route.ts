import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ticketMessageSchema } from "@/lib/validations";
import { getErrorMessage } from "@/lib/errors";

// Admin reply to a ticket
export async function POST(
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
    const validated = ticketMessageSchema.parse(body);
    const message = validated.message;
    const attachmentUrls = validated.attachmentUrls || [];
    const attachmentNames = validated.attachmentNames || [];

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    const [newMessage] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: id,
          senderRole: "ADMIN",
          senderName: session.user?.name || "Admin",
          message,
          attachmentUrls,
          attachmentNames,
        },
      }),
      prisma.supportTicket.update({
        where: { id },
        data: {
          status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Admin reply error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to send reply" }, { status: 500 });
  }
}
