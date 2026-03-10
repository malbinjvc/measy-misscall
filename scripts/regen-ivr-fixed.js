const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Load .env
const envContent = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (t.length === 0 || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (process.env[k] === undefined) process.env[k] = v;
}

const { PrismaClient } = require("@prisma/client");
const ENCRYPTION_PREFIX = "enc:";

function decryptValue(text) {
  const key = process.env.ENCRYPTION_KEY;
  const raw = text.slice(ENCRYPTION_PREFIX.length);
  const buf = Buffer.from(raw, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct, null, "utf8") + decipher.final("utf8");
}

async function main() {
  const p = new PrismaClient();

  // Get ElevenLabs config
  const settings = await p.platformSettings.findUnique({ where: { id: "platform-settings" } });
  let apiKey = settings.elevenlabsApiKey;
  if (apiKey && apiKey.startsWith(ENCRYPTION_PREFIX)) apiKey = decryptValue(apiKey);
  const voiceId = settings.elevenlabsVoiceId || "21m00Tcm4TlvDq8ikWAM";

  // Get tenant
  const tenant = await p.tenant.findFirst({ where: { status: "ACTIVE" } });
  console.log("Tenant:", tenant.name, tenant.id);

  // Generate with correct hardcoded text (matches UI preview exactly)
  const text = `You have reached ${tenant.name}. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.`;
  console.log("Text:", text);

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });

  if (!response.ok) {
    console.error("ElevenLabs error:", response.status, response.statusText);
    await p.$disconnect();
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const ivrDir = path.join(__dirname, "..", "public", "uploads", "ivr");
  if (!fs.existsSync(ivrDir)) fs.mkdirSync(ivrDir, { recursive: true });

  const filename = `${tenant.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}.mp3`;
  fs.writeFileSync(path.join(ivrDir, filename), buffer);

  const audioUrl = `/uploads/ivr/${filename}`;
  await p.tenant.update({ where: { id: tenant.id }, data: { ivrAudioUrl: audioUrl } });

  console.log("Audio generated and saved:", audioUrl);
  await p.$disconnect();
}

main().catch(console.error);
