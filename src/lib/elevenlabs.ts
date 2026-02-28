import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

const IVR_DIR = path.join(process.cwd(), "public", "uploads", "ivr");

export const SHARED_IVR_MESSAGES: Record<string, string> = {
  "noinput": "We did not receive any input. Goodbye.",
  "thankyou-booking": "Thank you! We have sent you a text message with a link to check out our services. Goodbye!",
  "thankyou-callback": "Thank you for requesting a callback! Our team will reach out to you as soon as possible. Goodbye!",
  "invalid": "Sorry, that was not a valid option. Goodbye!",
  "error": "We are sorry, an error occurred. Please try again later.",
};

async function getElevenLabsConfig() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform-settings" },
  });

  const apiKey = settings?.elevenlabsApiKey;
  if (!apiKey) return null;

  return {
    apiKey,
    voiceId: settings.elevenlabsVoiceId || DEFAULT_VOICE_ID,
  };
}

async function synthesize(
  text: string,
  apiKey: string,
  voiceId: string
): Promise<Buffer | null> {
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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    console.error(
      `ElevenLabs API error: ${response.status} ${response.statusText}`
    );
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function ensureDir() {
  if (!fs.existsSync(IVR_DIR)) {
    fs.mkdirSync(IVR_DIR, { recursive: true });
  }
}

export async function generateIvrAudio(
  businessName: string,
  tenantId: string
): Promise<string | null> {
  try {
    const config = await getElevenLabsConfig();
    if (!config) {
      console.warn("ElevenLabs API key not configured, skipping IVR audio generation");
      return null;
    }

    const text = `You have reached ${businessName}. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.`;

    const buffer = await synthesize(text, config.apiKey, config.voiceId);
    if (!buffer) return null;

    ensureDir();
    const filename = `${tenantId}-${Date.now()}.mp3`;
    fs.writeFileSync(path.join(IVR_DIR, filename), buffer);

    // Also generate shared messages if they don't exist yet
    generateSharedIvrAudios().catch((err) =>
      console.warn("Shared IVR audio generation failed (non-blocking):", err)
    );

    return `/uploads/ivr/${filename}`;
  } catch (error) {
    console.error("Failed to generate IVR audio:", error);
    return null;
  }
}

export async function generateSharedIvrAudios(): Promise<boolean> {
  try {
    const config = await getElevenLabsConfig();
    if (!config) {
      console.warn("ElevenLabs API key not configured, skipping shared IVR audio generation");
      return false;
    }

    ensureDir();

    for (const [key, text] of Object.entries(SHARED_IVR_MESSAGES)) {
      const filename = `shared-${key}.mp3`;
      const filePath = path.join(IVR_DIR, filename);

      // Skip if already exists
      if (fs.existsSync(filePath)) continue;

      console.log(`Generating shared IVR audio: ${key}...`);
      const buffer = await synthesize(text, config.apiKey, config.voiceId);
      if (buffer) {
        fs.writeFileSync(filePath, buffer);
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to generate shared IVR audios:", error);
    return false;
  }
}

export function getSharedAudioUrl(key: string): string | null {
  const filePath = path.join(IVR_DIR, `shared-${key}.mp3`);
  if (fs.existsSync(filePath)) {
    return `/uploads/ivr/shared-${key}.mp3`;
  }
  return null;
}
