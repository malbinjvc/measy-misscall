import { getTwilioClient } from "@/lib/twilio";
import prisma from "@/lib/prisma";

/**
 * Release a tenant's assigned Twilio number back to the platform.
 * Deletes the number from the Twilio account so it stops billing.
 */
export async function releaseTwilioNumber(twilioNumber: string): Promise<boolean> {
  try {
    console.log(`Attempting to release Twilio number: ${twilioNumber}`);
    const client = await getTwilioClient();
    // Find the incoming phone number SID by its number
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: twilioNumber, limit: 1 });
    console.log(`Found ${numbers.length} matching number(s) in Twilio for ${twilioNumber}`);
    if (numbers.length > 0) {
      const numberResource = numbers[0];
      // Detach emergency address AND regular address before releasing
      // Twilio blocks number removal if an emergency address is still attached
      if (numberResource.emergencyAddressSid || numberResource.addressSid) {
        console.log(`Detaching addresses from ${twilioNumber} (emergency: ${numberResource.emergencyAddressSid}, address: ${numberResource.addressSid})`);
        try {
          const updatePayload: Record<string, string> = {};
          if (numberResource.emergencyAddressSid) updatePayload.emergencyAddressSid = "";
          if (numberResource.addressSid) updatePayload.addressSid = "";
          await client.incomingPhoneNumbers(numberResource.sid).update(updatePayload);
          console.log(`Successfully detached addresses from ${twilioNumber}`);
        } catch (detachError: unknown) {
          const msg = detachError instanceof Error ? detachError.message : "Unknown error";
          console.error(`Failed to detach addresses from ${twilioNumber}:`, msg);
          // Still attempt removal — some Twilio accounts may not require this
        }
      }
      await client.incomingPhoneNumbers(numberResource.sid).remove();
      console.log(`Successfully released Twilio number ${twilioNumber} (SID: ${numberResource.sid})`);
      return true;
    } else {
      console.warn(`Number ${twilioNumber} not found in Twilio account — may have already been released`);
      return true; // Already gone, consider it released
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to release Twilio number ${twilioNumber}:`, msg);
    // Don't throw — number release failure shouldn't block the admin action
    return false;
  }
}

/**
 * Queue a failed Twilio number release for retry by the cron job.
 * Creates a TwilioCleanupQueue entry with nextRetryAt set 30 minutes from now.
 */
export async function queueTwilioCleanup(params: {
  phoneNumber: string;
  tenantId?: string;
  tenantName?: string;
  reason: string;
  lastError?: string;
}) {
  try {
    const nextRetryAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    await prisma.twilioCleanupQueue.create({
      data: {
        phoneNumber: params.phoneNumber,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        reason: params.reason,
        attempts: 1, // The inline attempt already happened
        lastError: params.lastError ?? "Initial release attempt failed",
        nextRetryAt,
      },
    });
    console.log(`Queued Twilio cleanup for ${params.phoneNumber} — next retry at ${nextRetryAt.toISOString()}`);
  } catch (error) {
    // Never block the main operation if queueing fails
    console.error("Failed to queue Twilio cleanup:", error);
  }
}
