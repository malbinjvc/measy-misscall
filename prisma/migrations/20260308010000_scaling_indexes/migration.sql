-- SmsLog compound index for tenant + status queries
CREATE INDEX "SmsLog_tenantId_status_idx" ON "SmsLog"("tenantId", "status");

-- Appointment compound index for customers API (groupBy + last booking)
CREATE INDEX "Appointment_tenantId_customerPhone_idx" ON "Appointment"("tenantId", "customerPhone");
