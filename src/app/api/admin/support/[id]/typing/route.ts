import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setTyping, getTyping } from "@/lib/typing-store";

// GET: Check if tenant is typing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  const { id } = await params;
  const typing = getTyping(id, "ADMIN");
  return NextResponse.json({ success: true, typing });
}

// POST: Admin is typing
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  const { id } = await params;
  setTyping(id, "ADMIN", session.user?.name || "Admin");
  return NextResponse.json({ success: true });
}
