-- AlterEnum: Add BOOKING_LINK to IvrResponse
ALTER TYPE "IvrResponse" ADD VALUE IF NOT EXISTS 'BOOKING_LINK';

-- AlterTable: Add callbackHandled to Call
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callbackHandled" BOOLEAN NOT NULL DEFAULT false;
