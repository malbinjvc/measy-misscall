-- Move any tenants currently on PHONE_SETUP to SUBSCRIPTION
UPDATE "Tenant" SET "onboardingStep" = 'SUBSCRIPTION' WHERE "onboardingStep" = 'PHONE_SETUP';

-- Remove the PHONE_SETUP value from the OnboardingStep enum
ALTER TYPE "OnboardingStep" RENAME TO "OnboardingStep_old";
CREATE TYPE "OnboardingStep" AS ENUM ('BUSINESS_PROFILE', 'INDUSTRY', 'SUBSCRIPTION', 'REVIEW');
ALTER TABLE "Tenant" ALTER COLUMN "onboardingStep" DROP DEFAULT;
ALTER TABLE "Tenant" ALTER COLUMN "onboardingStep" TYPE "OnboardingStep" USING ("onboardingStep"::text::"OnboardingStep");
ALTER TABLE "Tenant" ALTER COLUMN "onboardingStep" SET DEFAULT 'BUSINESS_PROFILE';
DROP TYPE "OnboardingStep_old";
