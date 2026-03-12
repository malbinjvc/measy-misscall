import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Lightweight endpoint for middleware to check maintenance mode
// No auth required — only returns a boolean, no sensitive data
export async function GET() {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
      select: { maintenanceMode: true },
    });
    return NextResponse.json(
      { enabled: settings?.maintenanceMode ?? false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { enabled: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
