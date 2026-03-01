-- CreateTable
CREATE TABLE "TwilioCleanupQueue" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwilioCleanupQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwilioCleanupQueue_status_nextRetryAt_idx" ON "TwilioCleanupQueue"("status", "nextRetryAt");
