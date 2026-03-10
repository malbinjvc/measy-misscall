const twilio = require("twilio");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const p = new PrismaClient();

function decrypt(text) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return text;
  const parts = text.split(":");
  if (parts.length !== 3) return text;
  const [ivHex, encrypted, tagHex] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(encrypted, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

(async () => {
  const settings = await p.platformSettings.findUnique({
    where: { id: "platform-settings" },
    select: { sharedTwilioSid: true, sharedTwilioToken: true }
  });
  const sid = settings?.sharedTwilioSid || process.env.TWILIO_ACCOUNT_SID;
  let token = settings?.sharedTwilioToken;
  if (token && token.includes(":")) {
    token = decrypt(token);
  }
  token = token || process.env.TWILIO_AUTH_TOKEN;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const voiceUrl = baseUrl + "/api/twilio/voice";
  const smsUrl = baseUrl + "/api/twilio/sms-status";

  const client = twilio(sid, token);

  // Get all numbers
  const allNumbers = await client.incomingPhoneNumbers.list();
  for (const num of allNumbers) {
    const needsUpdate = num.voiceUrl !== voiceUrl || num.smsUrl !== smsUrl;
    if (needsUpdate) {
      console.log("Updating:", num.phoneNumber);
      console.log("  Old voiceUrl:", num.voiceUrl);
      console.log("  Old smsUrl:", num.smsUrl);
      await client.incomingPhoneNumbers(num.sid).update({
        voiceUrl,
        voiceMethod: "POST",
        smsUrl,
        smsMethod: "POST",
      });
      console.log("  New voiceUrl:", voiceUrl);
      console.log("  New smsUrl:", smsUrl);
    } else {
      console.log("OK:", num.phoneNumber, "(already synced)");
    }
  }

  await p.$disconnect();
  console.log("\nDone.");
})();
