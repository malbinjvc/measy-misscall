-- Call compound indexes for dashboard stats
CREATE INDEX "Call_tenantId_status_idx" ON "Call"("tenantId", "status");
CREATE INDEX "Call_tenantId_ivrResponse_callbackHandled_idx" ON "Call"("tenantId", "ivrResponse", "callbackHandled");

-- Appointment compound indexes for dashboard stats
CREATE INDEX "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");
CREATE INDEX "Appointment_tenantId_date_idx" ON "Appointment"("tenantId", "date");
CREATE INDEX "Appointment_tenantId_createdAt_idx" ON "Appointment"("tenantId", "createdAt");
