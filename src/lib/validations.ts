import { z } from "zod";

// ─── Auth ────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and a number"),
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
  facebookUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  instagramUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  mapUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  businessPhoneNumber: z.string().min(10, "Business phone number is required"),
  autoConfirmAppointments: z.boolean().optional(),
  maxConcurrentBookings: z.number().int().min(1).max(50).optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  description: z.string().optional(),
  duration: z.number().min(15, "Minimum 15 minutes").max(480, "Maximum 8 hours"),
  price: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

// ─── Appointments ────────────────────────────────────

export const appointmentItemSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  serviceOptionId: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  selectedSubOptionIds: z.array(z.string()).optional(),
});

export const createAppointmentSchema = z.object({
  // Multi-item array (preferred)
  items: z.array(appointmentItemSchema).min(1).optional(),
  // Legacy single-service fields (fallback)
  serviceId: z.string().min(1, "Service is required").optional(),
  serviceOptionId: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  selectedSubOptionIds: z.array(z.string()).optional(),
  customerName: z.string().min(2, "Name is required"),
  customerPhone: z.string().min(10, "Phone number is required"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Time is required"),
  notes: z.string().optional(),
  verificationCode: z.string().length(6, "Verification code must be 6 digits").optional(),
  vehicleYear: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  appointmentPreference: z.enum(["DROP_OFF", "WAIT_FOR_IT", "PICKUP_DROPOFF"]).optional(),
  smsConsent: z.boolean().optional(),
}).refine(
  (data) => data.items?.length || data.serviceId,
  { message: "Either items array or serviceId is required", path: ["serviceId"] }
);

export const updateAppointmentSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  vehicleYear: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  appointmentPreference: z.enum(["DROP_OFF", "WAIT_FOR_IT", "PICKUP_DROPOFF"]).optional(),
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

const timeStringSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  "Time must be in HH:MM format (00:00–23:59)"
);

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
      openTime: timeStringSchema,
      closeTime: timeStringSchema,
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
  elevenlabsApiKey: z.string().optional(),
  elevenlabsVoiceId: z.string().optional(),
  dashboardBannerUrl: z.string().optional().nullable(),
  dashboardBannerType: z.enum(["image", "video"]).optional(),
  dashboardBannerLink: z.string().url("Invalid URL").optional().nullable().or(z.literal("")),
  dashboardBannerEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
});

// ─── Support Tickets ────────────────────────────────

export const createTicketSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export const ticketMessageSchema = z.object({
  message: z.string().max(5000).default(""),
  attachmentUrls: z.array(z.string()).optional(),
  attachmentNames: z.array(z.string()).optional(),
}).refine(
  (data) => data.message.trim().length > 0 || (data.attachmentUrls && data.attachmentUrls.length > 0),
  { message: "Message or attachment is required", path: ["message"] }
);

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

// ─── Reviews ─────────────────────────────────────────

export const reviewSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters").max(100),
  customerPhone: z.string().min(10, "Phone number is required"),
  rating: z.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
  comment: z.string().max(1000).optional(),
  imageUrl: z.string().optional().or(z.literal("")),
  verificationCode: z.string().length(6, "Verification code must be 6 digits"),
});

export const phoneVerificationSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().length(6, "Code must be 6 digits"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and a number"),
});

// ─── Review Import ──────────────────────────────────

export const importedReviewSchema = z.object({
  serialNumber: z.number().int().positive().optional(),
  customerName: z.string().min(1).max(200),
  rating: z.number().int().min(1).max(5),
  relativeDate: z.string().min(1),
  comment: z.string().max(5000).optional().nullable(),
  photoUrls: z.array(z.string().url()).default([]),
});

export const reviewImportPayloadSchema = z.object({
  tenantId: z.string().min(1),
  reviews: z.array(importedReviewSchema).min(1).max(500),
});

// ─── Inline validation schemas (for routes without dedicated schemas) ────

export const deleteByIdSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const deleteTenantSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
});

export const testTwilioSchema = z.object({
  sid: z.string().min(1, "Account SID is required"),
  token: z.string().min(1, "Auth Token is required"),
});

export const updateTenantAdminSchema = z.object({
  id: z.string().min(1, "Tenant ID is required"),
  status: z.enum(["ONBOARDING", "ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  assignedTwilioNumber: z.string().optional().nullable(),
});

export const updateCallSchema = z.object({
  callId: z.string().min(1, "Call ID is required"),
  callbackHandled: z.boolean(),
});

export const onboardingStepSchema = z.object({
  step: z.string().min(1, "Step is required"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: z.any().optional().default({}),
});

export const sendOtpSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(500, "Message too long"),
});

export const checkoutSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

export const purchaseNumberSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number is required"),
});

// ─── Customer Profile ────────────────────────────────

export const updateCustomerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  smsConsent: z.boolean().optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ─── Website Builder ─────────────────────────────────

const textShadowConfigSchema = z.object({
  enabled: z.boolean(),
  x: z.number(),
  y: z.number(),
  blur: z.number().min(0),
  color: z.string(),
});

const textGradientConfigSchema = z.object({
  enabled: z.boolean(),
  from: z.string(),
  to: z.string(),
  direction: z.string(),
});

const textConfigSchema = z.object({
  content: z.string().max(5000),
  fontFamily: z.string(),
  fontSize: z.number().min(8).max(200),
  fontWeight: z.number().min(100).max(900),
  color: z.string(),
  alignment: z.enum(["left", "center", "right"]),
  letterSpacing: z.number(),
  lineHeight: z.number().min(0.5).max(4),
  textShadow: textShadowConfigSchema.optional(),
  gradient: textGradientConfigSchema.optional(),
});

const ctaConfigSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(100),
  url: z.string().max(500),
});

const overlayConfigSchema = z.object({
  color: z.string(),
  opacity: z.number().min(0).max(1),
});

const themeSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontFamily: z.string(),
  backgroundColor: z.string(),
});

const navBarSchema = z.object({
  logoUrl: z.string().nullable(),
  logoType: z.enum(["image", "gif", "video"]),
  logoHeight: z.number().min(16).max(120),
  showName: z.boolean(),
});

const heroSectionSchema = z.object({
  type: z.literal("hero"),
  id: z.string(),
  visible: z.boolean(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  headline: textConfigSchema,
  subtitle: textConfigSchema,
  cta: ctaConfigSchema,
  overlay: overlayConfigSchema,
  minHeight: z.number().min(20).max(100),
});

const reviewsSectionSchema = z.object({
  type: z.literal("reviews"),
  id: z.string(),
  visible: z.boolean(),
  title: textConfigSchema,
});

const servicesSectionSchema = z.object({
  type: z.literal("services"),
  id: z.string(),
  visible: z.boolean(),
  title: textConfigSchema,
});

const aboutSectionSchema = z.object({
  type: z.literal("about"),
  id: z.string(),
  visible: z.boolean(),
  title: textConfigSchema,
  body: textConfigSchema,
});

const textBlockSectionSchema = z.object({
  type: z.literal("text-block"),
  id: z.string(),
  visible: z.boolean(),
  title: textConfigSchema,
  body: textConfigSchema,
  backgroundColor: z.string(),
  padding: z.number().min(0).max(200),
});

const mediaBlockSectionSchema = z.object({
  type: z.literal("media-block"),
  id: z.string(),
  visible: z.boolean(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  caption: textConfigSchema,
  aspectRatio: z.enum(["16/9", "4/3", "1/1", "auto"]),
});

const textOverMediaSectionSchema = z.object({
  type: z.literal("text-over-media"),
  id: z.string(),
  visible: z.boolean(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  headline: textConfigSchema,
  subtitle: textConfigSchema,
  cta: ctaConfigSchema,
  overlay: overlayConfigSchema,
  minHeight: z.number().min(20).max(100),
});

// ─── Element Schemas ────────────────────────────────

const textElementSchema = z.object({
  type: z.literal("text"),
  id: z.string(),
  title: textConfigSchema,
  body: textConfigSchema,
});

const mediaElementSchema = z.object({
  type: z.literal("media"),
  id: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  caption: textConfigSchema,
  aspectRatio: z.enum(["16/9", "4/3", "1/1", "auto"]),
});

const textOverMediaElementSchema = z.object({
  type: z.literal("text-over-media"),
  id: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  headline: textConfigSchema,
  subtitle: textConfigSchema,
  cta: ctaConfigSchema,
  overlay: overlayConfigSchema,
  minHeight: z.number().min(20).max(100),
});

const sectionElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  mediaElementSchema,
  textOverMediaElementSchema,
]);

const customSectionSchema = z.object({
  type: z.literal("custom"),
  id: z.string(),
  visible: z.boolean(),
  name: z.string().max(100),
  backgroundColor: z.string(),
  padding: z.number().min(0).max(200),
  elements: z.array(sectionElementSchema).max(20),
});

// ─── Reel Section ───────────────────────────────────

const reelCardSchema = z.object({
  id: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: z.enum(["image", "video"]),
  headline: textConfigSchema,
  subtitle: textConfigSchema,
  overlay: overlayConfigSchema,
});

const reelSectionSchema = z.object({
  type: z.literal("reel"),
  id: z.string(),
  visible: z.boolean(),
  name: z.string().max(100),
  cards: z.array(reelCardSchema).max(10),
});

// ─── Section Union (current) ────────────────────────

const websiteSectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  reviewsSectionSchema,
  servicesSectionSchema,
  customSectionSchema,
  reelSectionSchema,
]);

// ─── Legacy section schemas (for migration support) ─

const legacySectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  reviewsSectionSchema,
  servicesSectionSchema,
  aboutSectionSchema,
  textBlockSectionSchema,
  mediaBlockSectionSchema,
  textOverMediaSectionSchema,
  customSectionSchema,
  reelSectionSchema,
]);

export const websiteConfigSchema = z.object({
  theme: themeSchema,
  navBar: navBarSchema.optional(),
  sections: z.array(legacySectionSchema).max(20),
});

// ─── Type exports ────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
// --- Campaigns ---

export const createCampaignSchema = z.object({
  name: z.string().min(2, "Campaign name is required").max(100),
  message: z.string().min(10, "Message must be at least 10 characters").max(320, "Message too long (max 320 characters)"),
  customerIds: z.array(z.string()).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ServiceSubOptionInput = z.infer<typeof serviceSubOptionSchema>;
export type ServiceOptionInput = z.infer<typeof serviceOptionSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type PhoneVerificationInput = z.infer<typeof phoneVerificationSchema>;
