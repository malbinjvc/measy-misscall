-- AlterTable: Add walletRatePerUnit to PlatformSettings
ALTER TABLE "PlatformSettings" ADD COLUMN "walletRatePerUnit" DECIMAL(10,4) DEFAULT 0.035;

-- DropIndex: Remove single-column status index on Tenant (replaced by compound)
DROP INDEX IF EXISTS "Tenant_status_idx";

-- CreateIndex: Compound index for status + createdAt queries (admin tenants list)
CREATE INDEX "Tenant_status_createdAt_idx" ON "Tenant"("status", "createdAt");
