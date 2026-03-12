-- Fix foreign key constraints that block tenant cascade deletion.
-- When a Tenant is deleted, Service and Call records cascade-delete,
-- but Appointment/AppointmentItem/SmsLog reference them with RESTRICT.
-- Change to SET NULL so the parent can be deleted cleanly.

-- Appointment.serviceId -> Service (SET NULL)
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_serviceId_fkey";
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Appointment.serviceOptionId -> ServiceOption (SET NULL)
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_serviceOptionId_fkey";
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceOptionId_fkey"
  FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AppointmentItem.serviceId: make nullable + SET NULL
ALTER TABLE "AppointmentItem" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "AppointmentItem" DROP CONSTRAINT IF EXISTS "AppointmentItem_serviceId_fkey";
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AppointmentItem.serviceOptionId -> ServiceOption (SET NULL)
ALTER TABLE "AppointmentItem" DROP CONSTRAINT IF EXISTS "AppointmentItem_serviceOptionId_fkey";
ALTER TABLE "AppointmentItem" ADD CONSTRAINT "AppointmentItem_serviceOptionId_fkey"
  FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SmsLog.callId -> Call (SET NULL)
ALTER TABLE "SmsLog" DROP CONSTRAINT IF EXISTS "SmsLog_callId_fkey";
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_callId_fkey"
  FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
