/**
 * Integration test: Multi-tenant data isolation
 * Verifies that queries always scope by tenantId — no cross-tenant leakage.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  prisma,
  createTestTenant,
  createTestAppointment,
  cleanupTestData,
  type TestTenant,
} from "./helpers";

let tenantA: TestTenant;
let tenantB: TestTenant;

beforeAll(async () => {
  tenantA = await createTestTenant();
  tenantB = await createTestTenant();

  // Create appointments for both tenants
  await createTestAppointment(tenantA.tenant.id, tenantA.service.id, {
    customerPhone: "+14165550001",
  });
  await createTestAppointment(tenantA.tenant.id, tenantA.service.id, {
    customerPhone: "+14165550002",
    startTime: "11:00",
    endTime: "12:00",
  });
  await createTestAppointment(tenantB.tenant.id, tenantB.service.id, {
    customerPhone: "+14165550003",
  });

  // Create customers for both tenants
  await prisma.customer.create({
    data: {
      tenantId: tenantA.tenant.id,
      name: "Alice",
      phone: "4165550001",
    },
  });
  await prisma.customer.create({
    data: {
      tenantId: tenantB.tenant.id,
      name: "Bob",
      phone: "4165550003",
    },
  });
}, 30000);

afterAll(async () => {
  await cleanupTestData();
}, 15000);

describe("Multi-tenant isolation", () => {
  it("appointments scoped by tenantId — tenantA sees only its own", async () => {
    const apts = await prisma.appointment.findMany({
      where: { tenantId: tenantA.tenant.id },
    });
    expect(apts.length).toBe(2);
    expect(apts.every((a) => a.tenantId === tenantA.tenant.id)).toBe(true);
  });

  it("appointments scoped by tenantId — tenantB sees only its own", async () => {
    const apts = await prisma.appointment.findMany({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(apts.length).toBe(1);
    expect(apts[0].tenantId).toBe(tenantB.tenant.id);
  });

  it("services are isolated per tenant", async () => {
    const servicesA = await prisma.service.findMany({
      where: { tenantId: tenantA.tenant.id },
    });
    const servicesB = await prisma.service.findMany({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(servicesA.length).toBe(1);
    expect(servicesB.length).toBe(1);
    expect(servicesA[0].id).not.toBe(servicesB[0].id);
  });

  it("users are isolated per tenant", async () => {
    const usersA = await prisma.user.findMany({
      where: { tenantId: tenantA.tenant.id },
    });
    const usersB = await prisma.user.findMany({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(usersA.length).toBe(1);
    expect(usersB.length).toBe(1);
    expect(usersA[0].tenantId).toBe(tenantA.tenant.id);
    expect(usersB[0].tenantId).toBe(tenantB.tenant.id);
  });

  it("customers are isolated per tenant", async () => {
    const customersA = await prisma.customer.findMany({
      where: { tenantId: tenantA.tenant.id },
    });
    const customersB = await prisma.customer.findMany({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(customersA.length).toBe(1);
    expect(customersB.length).toBe(1);
    expect(customersA[0].name).toBe("Alice");
    expect(customersB[0].name).toBe("Bob");
  });

  it("business hours are isolated per tenant", async () => {
    const hoursA = await prisma.businessHours.findMany({
      where: { tenantId: tenantA.tenant.id },
    });
    const hoursB = await prisma.businessHours.findMany({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(hoursA.length).toBe(1);
    expect(hoursB.length).toBe(1);
    expect(hoursA[0].tenantId).not.toBe(hoursB[0].tenantId);
  });

  it("cascade delete removes all tenant data without affecting other tenants", async () => {
    // Create a throwaway tenant
    const temp = await createTestTenant();
    await createTestAppointment(temp.tenant.id, temp.service.id);

    // Delete the throwaway tenant
    await prisma.subscription.deleteMany({ where: { tenantId: temp.tenant.id } });
    await prisma.tenant.delete({ where: { id: temp.tenant.id } });

    // Verify tenantA and tenantB are unaffected
    const aCount = await prisma.appointment.count({
      where: { tenantId: tenantA.tenant.id },
    });
    const bCount = await prisma.appointment.count({
      where: { tenantId: tenantB.tenant.id },
    });
    expect(aCount).toBe(2);
    expect(bCount).toBe(1);

    // Verify throwaway data is gone
    const tempApts = await prisma.appointment.count({
      where: { tenantId: temp.tenant.id },
    });
    const tempServices = await prisma.service.count({
      where: { tenantId: temp.tenant.id },
    });
    expect(tempApts).toBe(0);
    expect(tempServices).toBe(0);
  });

  it("tenant slug is unique — no duplicate slugs", async () => {
    await expect(
      prisma.tenant.create({
        data: {
          name: "Duplicate",
          slug: tenantA.tenant.slug, // same slug as tenantA
          email: "dup@test.local",
        },
      })
    ).rejects.toThrow();
  });
});
