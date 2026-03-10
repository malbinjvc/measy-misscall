import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createTicketSchema } from "@/lib/validations";
import { getErrorMessage } from "@/lib/errors";

// List tickets for the current tenant
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const tickets = await prisma.supportTicket.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100, // Bounded: prevent unbounded result sets
    });

    return NextResponse.json({ success: true, data: tickets });
  } catch (error) {
    console.error("List tickets error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to fetch tickets" }, { status: 500 });
  }
}

// Create a new ticket
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subject, message, priority } = createTicketSchema.parse(body);
    const attachmentUrls: string[] = Array.isArray(body.attachmentUrls) ? body.attachmentUrls : [];
    const attachmentNames: string[] = Array.isArray(body.attachmentNames) ? body.attachmentNames : [];

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: session.user.tenantId,
        subject,
        priority,
        messages: {
          create: {
            senderRole: "TENANT",
            senderName: session.user.name || "Tenant",
            message,
            attachmentUrls,
            attachmentNames,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error) {
    console.error("Create ticket error:", getErrorMessage(error));
    return NextResponse.json({ success: false, error: "Failed to create ticket" }, { status: 500 });
  }
}
