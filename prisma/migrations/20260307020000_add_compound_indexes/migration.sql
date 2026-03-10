-- CreateIndex
CREATE INDEX "Call_tenantId_createdAt_idx" ON "Call"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_tenantId_createdAt_idx" ON "SmsLog"("tenantId", "createdAt");
