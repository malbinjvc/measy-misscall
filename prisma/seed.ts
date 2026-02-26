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
      businessPhoneNumber: "+15551234567",
      assignedTwilioNumber: "+15559876543",
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

  await prisma.appointment.deleteMany({ where: { tenantId: demoTenant.id } });
  await prisma.serviceSubOption.deleteMany({
    where: { serviceOption: { service: { tenantId: demoTenant.id } } },
  });
  await prisma.serviceOption.deleteMany({
    where: { service: { tenantId: demoTenant.id } },
  });
  await prisma.service.deleteMany({ where: { tenantId: demoTenant.id } });

  const createdServices: Record<string, string> = {};
  for (const service of services) {
    const created = await prisma.service.create({
      data: { ...service, tenantId: demoTenant.id },
    });
    createdServices[service.name] = created.id;
  }
  console.log(`${services.length} services created`);

  // Create service options for select services
  const serviceOptions = [
    // Oil Change options
    { serviceId: createdServices["Oil Change"], name: "Standard Oil Change", description: "Conventional oil", duration: 25, price: 30, sortOrder: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 5 },
    { serviceId: createdServices["Oil Change"], name: "Premium Oil Change", description: "Synthetic blend oil", duration: 30, price: 60, sortOrder: 1, defaultQuantity: 1, minQuantity: 1, maxQuantity: 5 },
    { serviceId: createdServices["Oil Change"], name: "Full Synthetic Oil Change", description: "Full synthetic oil with premium filter", duration: 35, price: 90, sortOrder: 2, defaultQuantity: 1, minQuantity: 1, maxQuantity: 3 },
    // Tyre Change options
    { serviceId: createdServices["Tyre Change"], name: "Single Tyre", description: "Replace one tyre", duration: 30, price: 50, sortOrder: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 4 },
    { serviceId: createdServices["Tyre Change"], name: "Pair (2 Tyres)", description: "Replace two tyres", duration: 45, price: 90, sortOrder: 1, defaultQuantity: 1, minQuantity: 1, maxQuantity: 2 },
    { serviceId: createdServices["Tyre Change"], name: "Full Set (4 Tyres)", description: "Replace all four tyres", duration: 60, price: 160, sortOrder: 2, defaultQuantity: 1, minQuantity: 1, maxQuantity: 1 },
    // Brake Pad Replacement options
    { serviceId: createdServices["Brake Pad Replacement"], name: "Front Brakes", description: "Front brake pad replacement", duration: 60, price: 150, sortOrder: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 1 },
    { serviceId: createdServices["Brake Pad Replacement"], name: "Rear Brakes", description: "Rear brake pad replacement", duration: 60, price: 150, sortOrder: 1, defaultQuantity: 1, minQuantity: 1, maxQuantity: 1 },
    { serviceId: createdServices["Brake Pad Replacement"], name: "Full Brake Service", description: "Front and rear brake pad replacement", duration: 120, price: 280, sortOrder: 2, defaultQuantity: 1, minQuantity: 1, maxQuantity: 1 },
  ];

  const createdOptions: Record<string, string> = {};
  for (const option of serviceOptions) {
    const created = await prisma.serviceOption.create({ data: option });
    createdOptions[option.name] = created.id;
  }
  console.log(`${serviceOptions.length} service options created`);

  // Create sample sub-options (add-ons)
  const subOptions = [
    // Standard Oil Change add-ons
    { serviceOptionId: createdOptions["Standard Oil Change"], name: "Add filter change", description: "Premium oil filter replacement", price: 10, sortOrder: 0 },
    { serviceOptionId: createdOptions["Standard Oil Change"], name: "Add fluid top-up", description: "Top up all fluids", price: 5, sortOrder: 1 },
    // Premium Oil Change add-ons
    { serviceOptionId: createdOptions["Premium Oil Change"], name: "Add engine flush", description: "Full engine flush before oil change", price: 20, sortOrder: 0 },
    { serviceOptionId: createdOptions["Premium Oil Change"], name: "Add filter change", description: "Premium oil filter replacement", price: 10, sortOrder: 1 },
  ];

  for (const sub of subOptions) {
    await prisma.serviceSubOption.create({ data: sub });
  }
  console.log(`${subOptions.length} service sub-options created`);

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

  // Create sample reviews
  await prisma.review.deleteMany({ where: { tenantId: demoTenant.id } });
  const reviews = [
    {
      customerName: "Sarah M.",
      customerPhone: "+15551112222",
      rating: 5,
      comment: "Excellent service! Got my tyres changed in under an hour. Very professional team.",
      isVerified: true,
    },
    {
      customerName: "Mike T.",
      customerPhone: "+15553334444",
      rating: 4,
      comment: "Good oil change service. Fair pricing and friendly staff. Will come back.",
      isVerified: true,
    },
    {
      customerName: "Lisa K.",
      customerPhone: "+15555556666",
      rating: 5,
      comment: "Best auto shop in Springfield! They fixed my brakes and the car drives like new.",
      isVerified: true,
    },
    {
      customerName: "David R.",
      customerPhone: "+15557778888",
      rating: 3,
      comment: "Decent service but had to wait a bit longer than expected. Quality of work was good though.",
      isVerified: true,
    },
  ];

  for (const review of reviews) {
    await prisma.review.create({
      data: { ...review, tenantId: demoTenant.id },
    });
  }
  console.log(`${reviews.length} reviews created`);

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
