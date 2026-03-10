-- Add concurrent booking capacity per tenant (default 1 preserves current behavior)
ALTER TABLE "Tenant" ADD COLUMN "maxConcurrentBookings" INTEGER NOT NULL DEFAULT 1;
