-- CreateTable
CREATE TABLE "AppointmentItem" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceOptionId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selectedSubOptions" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentItem_appointmentId_idx" ON "AppointmentItem"("appointmentId");

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Make Appointment.serviceId optional
ALTER TABLE "Appointment" ALTER COLUMN "serviceId" DROP NOT NULL;

-- DropForeignKey (re-add as optional)
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";

-- AddForeignKey (optional)
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Create AppointmentItem rows for existing appointments
INSERT INTO "AppointmentItem" ("id", "appointmentId", "serviceId", "serviceOptionId", "quantity", "selectedSubOptions", "sortOrder", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "serviceId",
    "serviceOptionId",
    "quantity",
    "selectedSubOptions",
    0,
    NOW(),
    NOW()
FROM "Appointment"
WHERE "serviceId" IS NOT NULL;
