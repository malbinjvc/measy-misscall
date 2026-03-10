-- ============================================================
-- Remove redundant single-column indexes (prefix-covered by existing compound indexes)
-- These waste write I/O on every INSERT/UPDATE without providing query benefit.
-- ============================================================

-- Call(tenantId) is prefix of Call(tenantId, createdAt) and Call(tenantId, status)
DROP INDEX IF EXISTS "Call_tenantId_idx";

-- Appointment(tenantId) is prefix of Appointment(tenantId, date, status) and others
DROP INDEX IF EXISTS "Appointment_tenantId_idx";

-- Appointment(tenantId, date) is prefix of Appointment(tenantId, date, status)
DROP INDEX IF EXISTS "Appointment_tenantId_date_idx";

-- SmsLog(tenantId) is prefix of SmsLog(tenantId, createdAt) and SmsLog(tenantId, status)
DROP INDEX IF EXISTS "SmsLog_tenantId_idx";

-- Customer(tenantId) is prefix of unique constraint Customer(tenantId, phone)
DROP INDEX IF EXISTS "Customer_tenantId_idx";

-- SupportTicket(tenantId) and SupportTicket(status) are replaced by compound indexes below
DROP INDEX IF EXISTS "SupportTicket_tenantId_idx";
DROP INDEX IF EXISTS "SupportTicket_status_idx";

-- TicketMessage(ticketId) is replaced by compound TicketMessage(ticketId, createdAt) below
DROP INDEX IF EXISTS "TicketMessage_ticketId_idx";

-- Review(tenantId) is replaced by compound Review(tenantId, isVerified, createdAt) below
DROP INDEX IF EXISTS "Review_tenantId_idx";

-- Appointment(date) and Appointment(status) are covered by new compound indexes
DROP INDEX IF EXISTS "Appointment_date_idx";
DROP INDEX IF EXISTS "Appointment_status_idx";

-- ============================================================
-- Add missing compound indexes for actual query patterns
-- ============================================================

-- Review: public reviews query filters by tenantId + isVerified, orders by createdAt
CREATE INDEX "Review_tenantId_isVerified_createdAt_idx" ON "Review"("tenantId", "isVerified", "createdAt");

-- TicketMessage: unread count queries need messages per ticket ordered by date
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- Appointment: cron reminder query filters by status + reminderSentAt IS NULL + date range
CREATE INDEX "Appointment_status_reminderSentAt_date_idx" ON "Appointment"("status", "reminderSentAt", "date");

-- SupportTicket: tenant ticket list filters by tenantId + status, orders by updatedAt
CREATE INDEX "SupportTicket_tenantId_status_updatedAt_idx" ON "SupportTicket"("tenantId", "status", "updatedAt");

-- SupportTicket: admin ticket list filters by status, orders by updatedAt
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");

-- PhoneVerification: cleanup cron deletes expired + unverified records
CREATE INDEX "PhoneVerification_expiresAt_verified_idx" ON "PhoneVerification"("expiresAt", "verified");
