-- AlterTable: Add monthly billing Stripe price ID to Plan
ALTER TABLE "Plan" ADD COLUMN "monthlyStripePriceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Plan_monthlyStripePriceId_key" ON "Plan"("monthlyStripePriceId");
