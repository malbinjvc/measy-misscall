const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Load .env manually
const envContent = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const ENCRYPTION_PREFIX = "enc:";

async function main() {
  const p = new PrismaClient();
  const tenant = await p.tenant.findUnique({
    where: { id: "cmma2a8yw000hiay04n908rgl" },
  });
  console.log("Tenant:", tenant.name);
  console.log("ivrGreeting:", tenant.ivrGreeting);
  console.log("ivrCallbackMessage:", tenant.ivrCallbackMessage);

  const settings = await p.platformSettings.findUnique({
    where: { id: "platform-settings" },
  });
  let apiKey = settings?.elevenlabsApiKey;
  if (!apiKey) {
    console.log("No ElevenLabs API key configured");
    await p.$disconnect();
    return;
  }

  if (apiKey.startsWith(ENCRYPTION_PREFIX)) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      console.log("No ENCRYPTION_KEY in env");
      await p.$disconnect();
      return;
    }
    const raw = apiKey.slice(ENCRYPTION_PREFIX.length);
    const buf = Buffer.from(raw, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(buf.length - 16);
    const ct = buf.subarray(12, buf.length - 16);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      iv
    );
    decipher.setAuthTag(tag);
    apiKey = decipher.update(ct, null, "utf8") + decipher.final("utf8");
  }

  const voiceId = settings?.elevenlabsVoiceId || "21m00Tcm4TlvDq8ikWAM";

  const greeting =
    tenant.ivrGreeting ||
    `You have reached ${tenant.name}. We could not take your call.`;
  const menu =
    tenant.ivrCallbackMessage ||
    "Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.";
  const text = `${greeting} ${menu}`;
  console.log("Generating audio for:", text);

  const resp = await fetch(
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

  if (!resp.ok) {
    console.error("ElevenLabs error:", resp.status, await resp.text());
    await p.$disconnect();
    return;
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  const ivrDir = path.join(process.cwd(), "public", "uploads", "ivr");
  if (!fs.existsSync(ivrDir)) fs.mkdirSync(ivrDir, { recursive: true });
  const filename = `${tenant.id}-${Date.now()}.mp3`;
  fs.writeFileSync(path.join(ivrDir, filename), buf);
  const audioUrl = `/uploads/ivr/${filename}`;

  await p.tenant.update({
    where: { id: tenant.id },
    data: { ivrAudioUrl: audioUrl },
  });
  console.log(`Done! New audio: ${audioUrl} (${buf.length} bytes)`);
  await p.$disconnect();
}

main().catch(console.error);
