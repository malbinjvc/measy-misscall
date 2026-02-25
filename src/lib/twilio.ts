import twilio from "twilio";

// Get Twilio client - always uses platform credentials
export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error("Twilio credentials not configured");
  }

  return twilio(sid, token);
}

// Validate Twilio webhook signature
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  return twilio.validateRequest(token, signature, url, params);
}

// Get the Twilio config for a tenant
export async function getTenantTwilioConfig(tenantId: string) {
  const { prisma } = await import("./prisma");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      assignedTwilioNumber: true,
      businessPhoneNumber: true,
      ivrGreeting: true,
      ivrCallbackMessage: true,
      ivrComplaintMessage: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) throw new Error("Tenant not found");

  return {
    client: getTwilioClient(),
    assignedTwilioNumber: tenant.assignedTwilioNumber,
    businessPhoneNumber: tenant.businessPhoneNumber,
    ivrGreeting: tenant.ivrGreeting || "Thank you for calling. We missed your call.",
    ivrCallbackMessage: tenant.ivrCallbackMessage || "Press 1 if you would like us to call you back.",
    ivrComplaintMessage: tenant.ivrComplaintMessage || "Press 2 to submit a complaint or feedback.",
    slug: tenant.slug,
    name: tenant.name,
  };
}
