import { PrismaClient } from "@prisma/client";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

async function main() {
  const prisma = new PrismaClient();

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
    });

    const apiKey = settings?.elevenlabsApiKey;
    if (!apiKey) {
      console.error("No ElevenLabs API key configured in PlatformSettings");
      process.exit(1);
    }

    const voiceId = settings.elevenlabsVoiceId || DEFAULT_VOICE_ID;

    const tenants = await prisma.tenant.findMany({
      where: { status: "ACTIVE", ivrAudioUrl: null },
    });

    console.log(`Found ${tenants.length} active tenant(s) without IVR audio`);

    for (const tenant of tenants) {
      console.log(`Generating audio for "${tenant.name}" (${tenant.id})...`);

      const text = `You have reached ${tenant.name}. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.`;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (!response.ok) {
        console.error(`  ElevenLabs API error: ${response.status} ${response.statusText}`);
        const body = await response.text();
        console.error(`  Response: ${body}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fs = await import("fs");
      const path = await import("path");
      const dir = path.join(process.cwd(), "public", "uploads", "ivr");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filename = `${tenant.id}-${Date.now()}.mp3`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);

      const audioUrl = `/uploads/ivr/${filename}`;
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { ivrAudioUrl: audioUrl },
      });

      console.log(`  Saved: ${audioUrl}`);
    }

    console.log("Done!");
  } finally {
    await prisma.$disconnect();
  }
}

main();
