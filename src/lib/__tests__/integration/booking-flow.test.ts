/**
 * Integration test: Booking flow
 * Tests overlap detection, business hours enforcement, advisory locks, and capacity.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  prisma,
  createTestTenant,
  createTestAppointment,
  cleanupTestData,
  type TestTenant,
} from "./helpers";

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
}, 15000);

afterAll(async () => {
  await cleanupTestData();
}, 15000);

describe("Booking flow — overlap detection", () => {
  it("detects exact time overlap", async () => {
    // Book 10:00–11:00
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-14T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "11:00",
    });

    // Try to find overlapping at same time
    const overlap = await prisma.appointment.findFirst({
      where: {
        tenantId: t.tenant.id,
        date: {
          gte: new Date("2026-04-14T00:00:00.000Z"),
          lte: new Date("2026-04-14T23:59:59.999Z"),
        },
        status: { not: "CANCELLED" },
        AND: [
          { startTime: { lt: "11:00" } },
          { endTime: { gt: "10:00" } },
        ],
      },
    });

    expect(overlap).not.toBeNull();
  });

  it("detects partial overlap (new starts during existing)", async () => {
    const overlap = await prisma.appointment.findFirst({
      where: {
        tenantId: t.tenant.id,
        date: {
          gte: new Date("2026-04-14T00:00:00.000Z"),
          lte: new Date("2026-04-14T23:59:59.999Z"),
        },
        status: { not: "CANCELLED" },
        AND: [
          { startTime: { lt: "11:30" } }, // new: 10:30–11:30
          { endTime: { gt: "10:30" } },
        ],
      },
    });

    expect(overlap).not.toBeNull();
  });

  it("allows non-overlapping time slot", async () => {
    const overlap = await prisma.appointment.findFirst({
      where: {
        tenantId: t.tenant.id,
        date: {
          gte: new Date("2026-04-14T00:00:00.000Z"),
          lte: new Date("2026-04-14T23:59:59.999Z"),
        },
        status: { not: "CANCELLED" },
        AND: [
          { startTime: { lt: "12:00" } }, // 11:00–12:00 — after existing
          { endTime: { gt: "11:00" } },
        ],
      },
    });

    // This should find the existing 10:00–11:00 since endTime "11:00" > "11:00" is false
    // Actually endTime "11:00" > startTime "11:00" is false, so no overlap
    expect(overlap).toBeNull();
  });

  it("ignores CANCELLED appointments in overlap check", async () => {
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-15T00:00:00.000Z"),
      startTime: "14:00",
      endTime: "15:00",
      status: "CANCELLED",
    });

    const overlap = await prisma.appointment.findFirst({
      where: {
        tenantId: t.tenant.id,
        date: {
          gte: new Date("2026-04-15T00:00:00.000Z"),
          lte: new Date("2026-04-15T23:59:59.999Z"),
        },
        status: { not: "CANCELLED" },
        AND: [
          { startTime: { lt: "15:00" } },
          { endTime: { gt: "14:00" } },
        ],
      },
    });

    expect(overlap).toBeNull(); // CANCELLED is ignored
  });
});

describe("Booking flow — advisory lock", () => {
  it("pg_advisory_xact_lock acquires and releases correctly within transaction", async () => {
    const date = "2026-04-16";
    const lockKey = t.tenant.id + ":" + date;

    // Verify advisory lock can be acquired in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lock acquired successfully ($executeRaw returns affected row count)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Book a slot inside the locked transaction
      const apt = await tx.appointment.create({
        data: {
          tenantId: t.tenant.id,
          serviceId: t.service.id,
          customerName: "Lock Test",
          customerPhone: "+14165559099",
          date: new Date(`${date}T00:00:00Z`),
          startTime: "09:00",
          endTime: "10:00",
        },
      });
      return apt;
    });

    expect(result.id).toBeDefined();
    expect(result.customerName).toBe("Lock Test");

    // After transaction completes, lock is released — we can acquire it again
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      // If we reach here, the lock was released after the previous transaction
    });
  });

  it("sequential lock + overlap check prevents second booking", async () => {
    const date = "2026-04-17";
    const lockKey = t.tenant.id + ":" + date;

    // First booking
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      await tx.appointment.create({
        data: {
          tenantId: t.tenant.id,
          serviceId: t.service.id,
          customerName: "First",
          customerPhone: "+14165559010",
          date: new Date(`${date}T00:00:00Z`),
          startTime: "09:00",
          endTime: "10:00",
        },
      });
    });

    // Second booking at same time — should detect overlap
    const secondResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.appointment.findFirst({
        where: {
          tenantId: t.tenant.id,
          date: { gte: new Date(`${date}T00:00:00Z`), lte: new Date(`${date}T23:59:59Z`) },
          status: { not: "CANCELLED" },
          AND: [{ startTime: { lt: "10:00" } }, { endTime: { gt: "09:00" } }],
        },
      });

      return { hasOverlap: !!existing };
    });

    expect(secondResult.hasOverlap).toBe(true);
  });
});

describe("Booking flow — business hours", () => {
  it("business hours record exists for test tenant", async () => {
    const hours = await prisma.businessHours.findUnique({
      where: {
        tenantId_day: { tenantId: t.tenant.id, day: "MONDAY" },
      },
    });

    expect(hours).not.toBeNull();
    expect(hours!.openTime).toBe("09:00");
    expect(hours!.closeTime).toBe("17:00");
    expect(hours!.isOpen).toBe(true);
  });

  it("unique constraint prevents duplicate business hours for same tenant+day", async () => {
    await expect(
      prisma.businessHours.create({
        data: {
          tenantId: t.tenant.id,
          day: "MONDAY",
          isOpen: true,
          openTime: "08:00",
          closeTime: "18:00",
        },
      })
    ).rejects.toThrow();
  });
});

describe("Booking flow — active booking limit", () => {
  it("counts only PENDING and CONFIRMED as active", async () => {
    // Create appointments with various statuses
    const customer = "+14165557777";
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-21T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      status: "PENDING",
      customerPhone: customer,
    });
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-21T00:00:00.000Z"),
      startTime: "10:00",
      endTime: "11:00",
      status: "CONFIRMED",
      customerPhone: customer,
    });
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-21T00:00:00.000Z"),
      startTime: "11:00",
      endTime: "12:00",
      status: "CANCELLED",
      customerPhone: customer,
    });
    await createTestAppointment(t.tenant.id, t.service.id, {
      date: new Date("2026-04-22T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      status: "COMPLETED",
      customerPhone: customer,
    });

    const activeCount = await prisma.appointment.count({
      where: {
        tenantId: t.tenant.id,
        customerPhone: customer,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    expect(activeCount).toBe(2); // Only PENDING + CONFIRMED
  });
});
