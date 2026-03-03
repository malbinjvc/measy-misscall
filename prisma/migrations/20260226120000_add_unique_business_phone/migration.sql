-- AlterTable: Add new phone columns and remove old Twilio columns
ALTER TABLE "Tenant" ADD COLUMN "assignedTwilioNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "businessPhoneNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "heroMediaUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "heroMediaType" TEXT DEFAULT 'image';
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "twilioAccountSid";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "twilioAuthToken";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "twilioPhoneNumber";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "forwardingNumber";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "useSharedTwilio";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "dialTimeout";

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_assignedTwilioNumber_key" ON "Tenant"("assignedTwilioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_businessPhoneNumber_key" ON "Tenant"("businessPhoneNumber");

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "ServiceOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL DEFAULT 10,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceSubOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceSubOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "imageUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PhoneVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- Add missing columns to Appointment (if not exists)
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD COLUMN "serviceOptionId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD COLUMN "selectedSubOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "ServiceOption_serviceId_idx" ON "ServiceOption"("serviceId");
CREATE INDEX IF NOT EXISTS "ServiceSubOption_serviceOptionId_idx" ON "ServiceSubOption"("serviceOptionId");
CREATE INDEX IF NOT EXISTS "Review_tenantId_idx" ON "Review"("tenantId");
CREATE INDEX IF NOT EXISTS "Review_rating_idx" ON "Review"("rating");
CREATE INDEX IF NOT EXISTS "PhoneVerification_phone_code_idx" ON "PhoneVerification"("phone", "code");

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceSubOption" ADD CONSTRAINT "ServiceSubOption_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
