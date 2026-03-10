-- Restore Appointment(date) index for cross-tenant date-range queries (cron, future reports)
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");
