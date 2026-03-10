import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSmsWithConsent, buildReminderSmsBody } from "@/lib/sms";
import { formatDateUTC } from "@/lib/utils";

const APP_TIMEZONE = "America/Toronto";

/**
 * Convert an appointment's date (UTC midnight) + startTime ("HH:mm")
 * to an absolute UTC timestamp in Toronto timezone.
 */
function appointmentToUtcTimestamp(date: Date, startTime: string): Date {
  // Shift to noon UTC to prevent day rollback from timezone offset
  const d = new Date(date);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    d.setUTCHours(12);
  }

  // Get the Toronto date string (YYYY-MM-DD)
  const torontoDate = d.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const [hours, minutes] = startTime.split(":").map(Number);

  // Build ISO string in Toronto time, then parse to get UTC
  // We use a formatter to find the UTC offset for this specific date in Toronto
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(d);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  // offsetPart.value is like "GMT-5" or "GMT-4"
  const offsetMatch = offsetPart?.value?.match(/GMT([+-]?\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;

  // Create UTC timestamp: Toronto time - offset = UTC
  const utc = new Date(`${torontoDate}T${startTime}:00.000Z`);
  utc.setUTCHours(utc.getUTCHours() - offsetHours);

  return utc;
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  // Window: appointments between 11.5 and 12.5 hours from now
  const windowStartMs = now + 11.5 * 60 * 60 * 1000;
  const windowEndMs = now + 12.5 * 60 * 60 * 1000;

  // Find CONFIRMED appointments with no reminder sent yet
  // We need to check date + startTime falls within our window
  // First, get appointments in a broad date range (today and tomorrow)
  const today = new Date();
  const twoDaysOut = new Date(today);
  twoDaysOut.setDate(twoDaysOut.getDate() + 2);

  const candidates = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      date: {
        gte: new Date(today.toISOString().split("T")[0] + "T00:00:00.000Z"),
        lte: new Date(twoDaysOut.toISOString().split("T")[0] + "T23:59:59.999Z"),
      },
    },
    include: {
      tenant: {
        select: { name: true, slug: true, assignedTwilioNumber: true },
      },
    },
  });

  // Filter candidates that fall within the reminder window
  const eligible = candidates.filter((apt) => {
    if (!apt.tenant.assignedTwilioNumber) return false;
    const aptMs = appointmentToUtcTimestamp(apt.date, apt.startTime).getTime();
    return aptMs >= windowStartMs && aptMs <= windowEndMs;
  });

  // Process in batches of 20 to avoid overwhelming Twilio
  const BATCH_SIZE = 20;
  let sentCount = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (apt) => {
        const dateStr = formatDateUTC(apt.date);
        const body = buildReminderSmsBody(apt.tenant.name, apt.tenant.slug, dateStr, apt.startTime);

        await sendSmsWithConsent({
          tenantId: apt.tenantId,
          to: apt.customerPhone,
          from: apt.tenant.assignedTwilioNumber!,
          body,
          type: "APPOINTMENT_REMINDER",
        });

        await prisma.appointment.update({
          where: { id: apt.id },
          data: { reminderSentAt: new Date() },
        });
      })
    );

    sentCount += results.filter((r) => r.status === "fulfilled").length;
    const errors = results.filter((r) => r.status === "rejected");
    for (const err of errors) {
      console.error("Reminder SMS error:", (err as PromiseRejectedResult).reason);
    }
  }

  console.log(`Appointment reminders cron: ${sentCount} reminders sent out of ${candidates.length} candidates`);
  return NextResponse.json({ success: true, sent: sentCount, candidates: candidates.length });
}
