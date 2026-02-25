import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create super admin
  const adminPassword = await bcrypt.hash("admin123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@measy.com" },
    update: {},
    create: {
      email: "admin@measy.com",
      name: "Super Admin",
      password: adminPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log("Super admin created:", superAdmin.email);

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: "joes-auto-shop" },
    update: {},
    create: {
      name: "Joe's Auto Shop",
      slug: "joes-auto-shop",
      email: "joe@example.com",
      phone: "+15551234567",
      address: "123 Main Street",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      description: "Full-service auto repair shop specializing in brake, tyre, and engine services.",
      status: "ACTIVE",
      onboardingStep: "REVIEW",
      forwardingNumber: "+15551234567",
      useSharedTwilio: true,
      dialTimeout: 20,
    },
  });
  console.log("Demo tenant created:", demoTenant.name);

  // Create tenant owner
  const ownerPassword = await bcrypt.hash("owner123", 12);
  const tenantOwner = await prisma.user.upsert({
    where: { email: "joe@example.com" },
    update: {},
    create: {
      email: "joe@example.com",
      name: "Joe Smith",
      password: ownerPassword,
      role: "TENANT_OWNER",
      tenantId: demoTenant.id,
    },
  });
  console.log("Tenant owner created:", tenantOwner.email);

  // Create demo services
  const services = [
    { name: "Tyre Change", duration: 45, price: 80, sortOrder: 1 },
    { name: "Oil Change", duration: 30, price: 50, sortOrder: 2 },
    { name: "Brake Inspection", duration: 60, price: 100, sortOrder: 3 },
    { name: "Brake Pad Replacement", duration: 90, price: 200, sortOrder: 4 },
    { name: "Battery Replacement", duration: 30, price: 150, sortOrder: 5 },
    { name: "Wheel Alignment", duration: 60, price: 75, sortOrder: 6 },
  ];

  for (const service of services) {
    await prisma.service.create({
      data: { ...service, tenantId: demoTenant.id },
    });
  }
  console.log(`${services.length} services created`);

  // Create business hours
  const days = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ] as const;

  for (const day of days) {
    await prisma.businessHours.upsert({
      where: { tenantId_day: { tenantId: demoTenant.id, day } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        day,
        isOpen: day !== "SUNDAY",
        openTime: "09:00",
        closeTime: day === "SATURDAY" ? "14:00" : "17:00",
      },
    });
  }
  console.log("Business hours created");

  // Create default plans
  const plans = [
    {
      name: "Starter",
      description: "Perfect for small businesses just getting started",
      price: 29,
      maxCalls: 50,
      maxSms: 50,
      maxServices: 5,
      maxStaff: 1,
      features: ["Basic IVR", "SMS Notifications", "Online Booking"],
      sortOrder: 1,
    },
    {
      name: "Professional",
      description: "Best for growing businesses with more demands",
      price: 79,
      maxCalls: 200,
      maxSms: 200,
      maxServices: 15,
      maxStaff: 5,
      features: [
        "Advanced IVR",
        "SMS Notifications",
        "Online Booking",
        "Complaint Management",
        "Priority Support",
      ],
      sortOrder: 2,
    },
    {
      name: "Enterprise",
      description: "For large operations needing unlimited access",
      price: 199,
      maxCalls: 1000,
      maxSms: 1000,
      maxServices: 50,
      maxStaff: 20,
      features: [
        "Custom IVR",
        "SMS Notifications",
        "Online Booking",
        "Complaint Management",
        "Priority Support",
        "Custom Integrations",
        "Dedicated Account Manager",
      ],
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.create({ data: plan });
  }
  console.log(`${plans.length} plans created`);

  // Create platform settings
  await prisma.platformSettings.upsert({
    where: { id: "platform-settings" },
    update: {},
    create: {
      id: "platform-settings",
    },
  });
  console.log("Platform settings created");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
