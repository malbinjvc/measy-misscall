-- Compound index for availability queries (tenantId + date + status)
CREATE INDEX "Appointment_tenantId_date_status_idx" ON "Appointment"("tenantId", "date", "status");

-- Compound index for phone verification rate limiting
CREATE INDEX "PhoneVerification_phone_createdAt_idx" ON "PhoneVerification"("phone", "createdAt");
