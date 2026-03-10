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

  // Check the number
  const nums = await client.incomingPhoneNumbers.list({ phoneNumber: "+12895142634" });
  const n = nums[0];

  console.log("=== Phone Number Config ===");
  console.log("voiceUrl:", n.voiceUrl);
  console.log("voiceApplicationSid:", n.voiceApplicationSid);
  console.log("trunkSid:", n.trunkSid);
  console.log("smsUrl:", n.smsUrl);
  console.log("smsApplicationSid:", n.smsApplicationSid);

  // If there's a TwiML App, check it
  if (n.voiceApplicationSid) {
    console.log("\n=== TwiML App Override Found! ===");
    const app = await client.applications(n.voiceApplicationSid).fetch();
    console.log("App Name:", app.friendlyName);
    console.log("App VoiceUrl:", app.voiceUrl);
    console.log("App VoiceMethod:", app.voiceMethod);
    console.log("App SmsFallbackUrl:", app.smsFallbackUrl);
    console.log("THIS IS OVERRIDING the number's voiceUrl!");
  } else {
    console.log("\nNo TwiML App attached. voiceUrl should be used directly.");
  }

  // Check if there are any Studio Flows attached
  try {
    const flows = await client.studio.v2.flows.list();
    for (const flow of flows) {
      console.log("\n=== Studio Flow ===");
      console.log("Name:", flow.friendlyName);
      console.log("Status:", flow.status);
    }
  } catch (e) {
    console.log("\nNo Studio flows or access denied");
  }

  // Check recent call logs to see what actually happened
  console.log("\n=== Recent Calls to +12895142634 ===");
  const calls = await client.calls.list({ to: "+12895142634", limit: 3 });
  for (const call of calls) {
    console.log(`  ${call.startTime} | ${call.from} -> ${call.to} | ${call.status} | ${call.duration}s`);
  }

  await p.$disconnect();
}

main().catch(console.error);
