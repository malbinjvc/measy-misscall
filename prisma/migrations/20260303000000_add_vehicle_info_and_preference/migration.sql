-- CreateEnum
CREATE TYPE "AppointmentPreference" AS ENUM ('DROP_OFF', 'WAIT_FOR_IT', 'PICKUP_DROPOFF');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "vehicleYear" TEXT,
ADD COLUMN "vehicleMake" TEXT,
ADD COLUMN "vehicleModel" TEXT,
ADD COLUMN "appointmentPreference" "AppointmentPreference";
