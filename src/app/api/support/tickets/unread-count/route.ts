import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Count unread tickets using SQL — single query, no in-memory filtering
    const tenantId = session.user.tenantId;
    const result = await prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int as count
      FROM "SupportTicket" st
      WHERE st."tenantId" = ${tenantId}
        AND st.status != 'CLOSED'
        AND EXISTS (
          SELECT 1 FROM "TicketMessage" tm
          WHERE tm."ticketId" = st.id
            AND tm."senderRole" = 'ADMIN'
            AND tm."createdAt" = (
              SELECT MAX(tm2."createdAt") FROM "TicketMessage" tm2 WHERE tm2."ticketId" = st.id
            )
            AND (st."lastReadByTenant" IS NULL OR tm."createdAt" > st."lastReadByTenant")
        )
    `;
    const unread = result[0]?.count ?? 0;

    return NextResponse.json({ success: true, count: unread });
  } catch {
    return NextResponse.json({ success: true, count: 0 });
  }
}
