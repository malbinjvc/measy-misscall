-- Add compound indexes for customer activity panel queries
-- These queries filter by (tenantId, phone) on high-volume tables

-- SmsLog: customer SMS activity queries filter by tenantId + toNumber (customer phone)
CREATE INDEX "SmsLog_tenantId_toNumber_idx" ON "SmsLog"("tenantId", "toNumber");

-- Call: customer calls activity queries filter by tenantId + callerNumber (customer phone)
CREATE INDEX "Call_tenantId_callerNumber_idx" ON "Call"("tenantId", "callerNumber");
