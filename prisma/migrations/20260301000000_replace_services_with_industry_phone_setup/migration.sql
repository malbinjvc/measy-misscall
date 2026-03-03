-- Add industry field to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "industry" TEXT;

-- Migrate any tenants currently on SERVICES step back to BUSINESS_PROFILE
UPDATE "Tenant" SET "onboardingStep" = 'BUSINESS_PROFILE' WHERE "onboardingStep" = 'SERVICES';

-- Replace the OnboardingStep enum: remove SERVICES, add INDUSTRY and PHONE_SETUP
-- PostgreSQL doesn't support removing enum values, so we swap the entire type
CREATE TYPE "OnboardingStep_new" AS ENUM ('BUSINESS_PROFILE', 'INDUSTRY', 'PHONE_SETUP', 'SUBSCRIPTION', 'REVIEW');

ALTER TABLE "Tenant"
  ALTER COLUMN "onboardingStep" DROP DEFAULT,
  ALTER COLUMN "onboardingStep" TYPE "OnboardingStep_new" USING ("onboardingStep"::text::"OnboardingStep_new"),
  ALTER COLUMN "onboardingStep" SET DEFAULT 'BUSINESS_PROFILE';

DROP TYPE "OnboardingStep";
ALTER TYPE "OnboardingStep_new" RENAME TO "OnboardingStep";
