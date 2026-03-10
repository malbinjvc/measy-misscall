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

const twilio = require("twilio");
const { PrismaClient } = require("@prisma/client");
const ENCRYPTION_PREFIX = "enc:";

function decrypt(text) {
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log("Current NEXT_PUBLIC_APP_URL:", appUrl);

  // Get Twilio creds from DB
  const settings = await p.platformSettings.findUnique({ where: { id: "platform-settings" } });
  let sid = settings.sharedTwilioSid || process.env.TWILIO_ACCOUNT_SID;
  let token = settings.sharedTwilioToken || process.env.TWILIO_AUTH_TOKEN;

  if (token && token.startsWith(ENCRYPTION_PREFIX)) {
    token = decrypt(token);
  }

  console.log("Twilio SID:", sid);
  const client = twilio(sid, token);

  const nums = await client.incomingPhoneNumbers.list({ phoneNumber: "+12895142634" });
  if (nums.length === 0) {
    console.log("Number not found");
    await p.$disconnect();
    return;
  }

  const n = nums[0];
  console.log("\n=== Current Twilio Config ===");
  console.log("SID:", n.sid);
  console.log("voiceUrl:", n.voiceUrl);
  console.log("voiceMethod:", n.voiceMethod);
  console.log("voiceFallbackUrl:", n.voiceFallbackUrl);
  console.log("smsUrl:", n.smsUrl);
  console.log("smsMethod:", n.smsMethod);
  console.log("statusCallback:", n.statusCallback);

  const expectedVoice = appUrl + "/api/twilio/voice";
  const expectedSms = appUrl + "/api/twilio/incoming-sms";

  console.log("\n=== Expected ===");
  console.log("voiceUrl:", expectedVoice);
  console.log("smsUrl:", expectedSms);

  if (n.voiceUrl !== expectedVoice || n.smsUrl !== expectedSms) {
    console.log("\nMISMATCH DETECTED — Updating...");
    await client.incomingPhoneNumbers(n.sid).update({
      voiceUrl: expectedVoice,
      voiceMethod: "POST",
      smsUrl: expectedSms,
      smsMethod: "POST",
    });
    console.log("DONE. Webhooks updated.");
  } else {
    console.log("\nAll URLs match. No update needed.");
  }

  await p.$disconnect();
}

main().catch(console.error);
