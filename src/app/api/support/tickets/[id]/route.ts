import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";

// Get a single ticket with all messages (marks as read by tenant)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    // Mark as read by tenant (fire-and-forget)
    prisma.supportTicket.update({
      where: { id },
      data: { lastReadByTenant: new Date() },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Get ticket error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to fetch ticket" }, { status: 500 });
  }
}
