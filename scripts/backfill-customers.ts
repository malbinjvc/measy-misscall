/**
 * One-time backfill script: Creates Customer records from existing Appointment data.
 *
 * Usage:
 *   npx tsx scripts/backfill-customers.ts
 *
 * This script:
 * 1. Queries all distinct (tenantId, customerPhone) combinations from Appointment
 * 2. For each, upserts a Customer record using the most recent appointment's data
 * 3. Reports how many customers were created/updated
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting customer backfill...");

  // Get all unique tenant+phone pairs from appointments
  const distinctPairs = await prisma.appointment.findMany({
    select: {
      tenantId: true,
      customerPhone: true,
    },
    distinct: ["tenantId", "customerPhone"],
  });

  console.log(`Found ${distinctPairs.length} unique tenant+phone pairs`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const pair of distinctPairs) {
    try {
      // Get the most recent appointment for this customer
      const latestAppointment = await prisma.appointment.findFirst({
        where: {
          tenantId: pair.tenantId,
          customerPhone: pair.customerPhone,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!latestAppointment) continue;

      const result = await prisma.customer.upsert({
        where: {
          tenantId_phone: {
            tenantId: pair.tenantId,
            phone: pair.customerPhone,
          },
        },
        create: {
          tenantId: pair.tenantId,
          name: latestAppointment.customerName,
          phone: pair.customerPhone,
          email: latestAppointment.customerEmail,
          smsConsent: latestAppointment.smsConsent,
          vehicleYear: latestAppointment.vehicleYear,
          vehicleMake: latestAppointment.vehicleMake,
          vehicleModel: latestAppointment.vehicleModel,
          vehicleType: latestAppointment.vehicleType,
        },
        update: {}, // Don't overwrite if already exists
      });

      // Check if it was created (createdAt close to now) or already existed
      const age = Date.now() - result.createdAt.getTime();
      if (age < 5000) {
        created++;
      } else {
        updated++;
      }
    } catch (err) {
      errors++;
      console.error(`Error processing ${pair.tenantId}/${pair.customerPhone}:`, err);
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Created: ${created}`);
  console.log(`  Already existed: ${updated}`);
  console.log(`  Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
