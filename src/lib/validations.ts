import { z } from "zod";

// ─── Auth ────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  phone: z.string().optional(),
});

// ─── Onboarding ──────────────────────────────────────

export const businessProfileSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  description: z.string().optional(),
  businessPhoneNumber: z.string().min(10, "Business phone number is required"),
});

export const serviceSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().min(15, "Minimum 15 minutes").max(480, "Maximum 8 hours"),
  price: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const servicesStepSchema = z.object({
  services: z.array(serviceSchema).min(1, "Add at least one service"),
});

// ─── Appointments ────────────────────────────────────

export const createAppointmentSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  serviceOptionId: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  selectedSubOptionIds: z.array(z.string()).optional(),
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Phone number is required"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Time is required"),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  notes: z.string().optional(),
});

// ─── Complaints ──────────────────────────────────────

export const createComplaintSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Phone number is required"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  category: z.enum(["SERVICE_QUALITY", "PRICING", "WAIT_TIME", "STAFF_BEHAVIOR", "OTHER"]),
  description: z.string().min(10, "Please provide more details (at least 10 characters)"),
  callId: z.string().optional(),
});

export const updateComplaintSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  resolution: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Service Sub-Options ─────────────────────────────

export const serviceSubOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Sub-option name is required"),
  description: z.string().optional(),
  price: z.number().min(0).optional().nullable(),
});

// ─── Service Options ─────────────────────────────────

export const serviceOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Option name is required"),
  description: z.string().optional(),
  duration: z.number().min(15).max(480).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
  defaultQuantity: z.number().int().min(1).default(1),
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().min(1).default(10),
  subOptions: z.array(serviceSubOptionSchema).optional(),
});

// ─── Services ────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().min(15).max(480),
  price: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
  options: z.array(serviceOptionSchema).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

// ─── Business Hours ──────────────────────────────────

export const businessHoursSchema = z.object({
  hours: z.array(
    z.object({
      day: z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]),
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    })
  ),
});

// ─── Admin ───────────────────────────────────────────

export const createPlanSchema = z.object({
  name: z.string().min(2, "Plan name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  interval: z.enum(["month", "year"]),
  maxCalls: z.number().min(1),
  maxSms: z.number().min(1),
  maxServices: z.number().min(1),
  maxStaff: z.number().min(1),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED", "DISABLED"]),
});

export const platformSettingsSchema = z.object({
  sharedTwilioSid: z.string().optional(),
  sharedTwilioToken: z.string().optional(),
  sharedTwilioNumber: z.string().optional(),
  defaultIvrGreeting: z.string().optional(),
  defaultIvrCallback: z.string().optional(),
  defaultIvrComplaint: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
});

// ─── Reviews ─────────────────────────────────────────

export const reviewSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters").max(100),
  customerPhone: z.string().min(10, "Phone number is required"),
  rating: z.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
  comment: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  verificationCode: z.string().length(6, "Verification code must be 6 digits"),
});

export const phoneVerificationSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
});

// ─── Type exports ────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
export type ServiceSubOptionInput = z.infer<typeof serviceSubOptionSchema>;
export type ServiceOptionInput = z.infer<typeof serviceOptionSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
