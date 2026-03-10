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
  const settings = await p.platformSettings.findUnique({ where: { id: "platform-settings" } });
  let sid = settings.sharedTwilioSid || process.env.TWILIO_ACCOUNT_SID;
  let token = settings.sharedTwilioToken || process.env.TWILIO_AUTH_TOKEN;
  if (token && token.startsWith(ENCRYPTION_PREFIX)) token = decryptValue(token);

  const client = twilio(sid, token);

  // Check ALL recent calls on the account
  console.log("=== All Recent Calls (last 10) ===");
  const calls = await client.calls.list({ limit: 10 });
  for (const call of calls) {
    console.log(`  ${call.dateCreated} | ${call.from} -> ${call.to} | status: ${call.status} | duration: ${call.duration}s | direction: ${call.direction}`);
  }

  // Check the tenant's business phone number — the customer calls THIS, and it forwards to Twilio
  const tenant = await p.tenant.findFirst({ where: { status: "ACTIVE" } });
  console.log("\n=== Tenant Phone Config ===");
  console.log("businessPhoneNumber:", tenant.businessPhoneNumber);
  console.log("assignedTwilioNumber:", tenant.assignedTwilioNumber);

  // Check ALL incoming numbers on the account
  console.log("\n=== All Twilio Numbers on Account ===");
  const allNums = await client.incomingPhoneNumbers.list();
  for (const n of allNums) {
    console.log(`  ${n.phoneNumber} | voiceUrl: ${n.voiceUrl} | voiceAppSid: ${n.voiceApplicationSid || "none"}`);
  }

  await p.$disconnect();
}

main().catch(console.error);
