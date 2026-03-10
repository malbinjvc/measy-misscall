import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setTyping, getTyping } from "@/lib/typing-store";

// GET: Check if admin is typing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const { id } = await params;
  const typing = getTyping(id, "TENANT");
  return NextResponse.json({ success: true, typing });
}

// POST: Tenant is typing
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  const { id } = await params;
  setTyping(id, "TENANT", session.user.name || "Tenant");
  return NextResponse.json({ success: true });
}
