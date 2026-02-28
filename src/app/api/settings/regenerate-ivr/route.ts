import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateIvrAudio } from "@/lib/elevenlabs";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 404 }
      );
    }

    const audioUrl = await generateIvrAudio(tenant.name, tenant.id);

    if (!audioUrl) {
      return NextResponse.json(
        { success: false, error: "Failed to generate audio. Check that ElevenLabs is configured in admin settings." },
        { status: 500 }
      );
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { ivrAudioUrl: audioUrl },
    });

    return NextResponse.json({ success: true, data: { ivrAudioUrl: audioUrl } });
  } catch (error) {
    console.error("Regenerate IVR error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate IVR audio" },
      { status: 500 }
    );
  }
}
