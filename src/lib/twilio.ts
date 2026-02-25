import twilio from "twilio";

// Get Twilio client - per-tenant or shared
export function getTwilioClient(
  accountSid?: string | null,
  authToken?: string | null
) {
  const sid = accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error("Twilio credentials not configured");
  }

  return twilio(sid, token);
}

// Validate Twilio webhook signature
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
  authToken?: string
): boolean {
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  return twilio.validateRequest(token, signature, url, params);
}

// Get the Twilio phone number for a tenant
export async function getTenantTwilioConfig(tenantId: string) {
  const { prisma } = await import("./prisma");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      twilioAccountSid: true,
      twilioAuthToken: true,
      twilioPhoneNumber: true,
      forwardingNumber: true,
      useSharedTwilio: true,
      ivrGreeting: true,
      ivrCallbackMessage: true,
      ivrComplaintMessage: true,
      dialTimeout: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) throw new Error("Tenant not found");

  return {
    client: getTwilioClient(
      tenant.useSharedTwilio ? null : tenant.twilioAccountSid,
      tenant.useSharedTwilio ? null : tenant.twilioAuthToken
    ),
    phoneNumber: tenant.useSharedTwilio
      ? process.env.TWILIO_PHONE_NUMBER
      : tenant.twilioPhoneNumber,
    forwardingNumber: tenant.forwardingNumber,
    ivrGreeting: tenant.ivrGreeting || "Thank you for calling. We missed your call.",
    ivrCallbackMessage: tenant.ivrCallbackMessage || "Press 1 if you would like us to call you back.",
    ivrComplaintMessage: tenant.ivrComplaintMessage || "Press 2 to submit a complaint or feedback.",
    dialTimeout: tenant.dialTimeout || 20,
    slug: tenant.slug,
    name: tenant.name,
  };
}

// Test Twilio connection
export async function testTwilioConnection(
  accountSid: string,
  authToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = twilio(accountSid, authToken);
    await client.api.accounts(accountSid).fetch();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
