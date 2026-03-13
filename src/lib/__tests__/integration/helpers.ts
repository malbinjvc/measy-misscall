/**
 * Integration test helpers — creates/cleans real DB records.
 * Uses a unique prefix per test run to avoid collisions.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

export const prisma = new PrismaClient();

const RUN_ID = crypto.randomUUID().slice(0, 8);
let counter = 0;
function uid() {
  return `t_${RUN_ID}_${++counter}`;
}

export interface TestTenant {
  tenant: Awaited<ReturnType<typeof prisma.tenant.create>>;
  user: Awaited<ReturnType<typeof prisma.user.create>>;
  service: Awaited<ReturnType<typeof prisma.service.create>>;
}

/**
 * Create an isolated tenant with a user, service, and business hours.
 */
export async function createTestTenant(overrides?: { slug?: string; status?: string }): Promise<TestTenant> {
  const slug = overrides?.slug || uid();
  const tenant = await prisma.tenant.create({
    data: {
      name: `Test Business ${slug}`,
      slug,
      email: `${slug}@test.local`,
      phone: "+14165550000",
      status: (overrides?.status as "ACTIVE") || "ACTIVE",
      businessPhoneNumber: `+1${RUN_ID.replace(/\W/g, '')}${String(counter).padStart(4, "0")}`,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `owner-${slug}@test.local`,
      name: "Test Owner",
      password: "$2b$10$fakehash", // not used in tests
      role: "TENANT_OWNER",
      tenantId: tenant.id,
    },
  });

  const service = await prisma.service.create({
    data: {
      name: "Test Service",
      duration: 60,
      price: 50,
      tenantId: tenant.id,
    },
  });

  // Create business hours for Monday
  await prisma.businessHours.create({
    data: {
      tenantId: tenant.id,
      day: "MONDAY",
      isOpen: true,
      openTime: "09:00",
      closeTime: "17:00",
    },
  });

  return { tenant, user, service };
}

/**
 * Create a test appointment for a tenant.
 */
export async function createTestAppointment(
  tenantId: string,
  serviceId: string,
  overrides?: {
    date?: Date;
    startTime?: string;
    endTime?: string;
    status?: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    customerPhone?: string;
  }
) {
  return prisma.appointment.create({
    data: {
      tenantId,
      serviceId,
      customerName: "Test Customer",
      customerPhone: overrides?.customerPhone || "+14165551111",
      date: overrides?.date || new Date("2026-04-14T00:00:00.000Z"), // A Monday
      startTime: overrides?.startTime || "10:00",
      endTime: overrides?.endTime || "11:00",
      status: overrides?.status || "PENDING",
    },
  });
}

/**
 * Create a plan and subscription for a tenant.
 */
export async function createTestSubscription(
  tenantId: string,
  features: string[] = ["missed_call_ivr", "appointment_sms"]
) {
  const plan = await prisma.plan.create({
    data: {
      name: `Test Plan ${uid()}`,
      price: 49,
      maxCalls: 100,
      maxSms: 200,
      maxServices: 10,
      maxStaff: 5,
      features,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: "ACTIVE",
    },
  });

  return { plan, subscription };
}

/**
 * Clean up all test data created by this test run.
 * Deletes by prefix to avoid touching non-test data.
 */
export async function cleanupTestData() {
  // Cascade deletes: deleting tenants removes all child records
  const testTenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: `t_${RUN_ID}_` } },
    select: { id: true },
  });

  if (testTenants.length > 0) {
    const ids = testTenants.map((t) => t.id);

    // Delete subscriptions first (references plan, not cascade from tenant for plan)
    await prisma.subscription.deleteMany({ where: { tenantId: { in: ids } } });

    // Delete tenants (cascades users, services, appointments, etc.)
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
  }

  // Clean up orphaned plans
  await prisma.plan.deleteMany({ where: { name: { startsWith: `Test Plan t_${RUN_ID}_` } } });

  await prisma.$disconnect();
}
