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

  const client = twilio(sid, token);
  const numbers = ["+13656039143", "+13656543756"];
  for (const num of numbers) {
    const results = await client.incomingPhoneNumbers.list({ phoneNumber: num });
    if (results.length > 0) {
      const n = results[0];
      console.log("Number:", num);
      console.log("  voiceUrl:", n.voiceUrl);
      console.log("  voiceMethod:", n.voiceMethod);
      console.log("  smsUrl:", n.smsUrl);
      console.log("  smsMethod:", n.smsMethod);
      console.log("");
    } else {
      console.log("Number:", num, "NOT FOUND in Twilio");
    }
  }
  await p.$disconnect();
})();
