import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const SHARED_IVR_MESSAGES: Record<string, string> = {
  "noinput": "We did not receive any input. Goodbye.",
  "thankyou-booking": "Thank you! We have sent you a text message with a link to check out our services. Goodbye!",
  "thankyou-callback": "Thank you for requesting a callback! Our team will reach out to you as soon as possible. Goodbye!",
  "invalid": "Sorry, that was not a valid option. Goodbye!",
  "error": "We are sorry, an error occurred. Please try again later.",
};

async function main() {
  const prisma = new PrismaClient();

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
    });

    const apiKey = settings?.elevenlabsApiKey;
    if (!apiKey) {
      console.error("No ElevenLabs API key configured");
      process.exit(1);
    }

    const voiceId = settings.elevenlabsVoiceId || DEFAULT_VOICE_ID;
    const dir = path.join(process.cwd(), "public", "uploads", "ivr");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    for (const [key, text] of Object.entries(SHARED_IVR_MESSAGES)) {
      const filename = `shared-${key}.mp3`;
      const filePath = path.join(dir, filename);

      console.log(`Generating: ${filename}...`);

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
        console.error(`  Failed: ${response.status} ${response.statusText}`);
        const body = await response.text();
        console.error(`  ${body}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      console.log(`  Saved: ${filePath}`);
    }

    console.log("Done!");
  } finally {
    await prisma.$disconnect();
  }
}

main();
