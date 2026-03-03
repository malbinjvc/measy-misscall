import {
  UserRole,
  TenantStatus,
  CallStatus,
  IvrResponse,
  AppointmentStatus,
  SmsStatus,
  SmsType,
  SubscriptionStatus,
  DayOfWeek,
  OnboardingStep,
} from "@prisma/client";

export type {
  UserRole,
  TenantStatus,
  CallStatus,
  IvrResponse,
  AppointmentStatus,
  SmsStatus,
  SmsType,
  SubscriptionStatus,
  DayOfWeek,
  OnboardingStep,
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalCalls: number;
  missedCalls: number;
  totalAppointments: number;
  pendingAppointments: number;
  totalSms: number;
  callbackRequests: number;
}

export interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  totalCalls: number;
  totalAppointments: number;
  totalRevenue: number;
  newTenantsThisMonth: number;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export const ONBOARDING_STEPS: { step: OnboardingStep; label: string; description: string }[] = [
  {
    step: "BUSINESS_PROFILE",
    label: "Business Profile",
    description: "Set up your business information",
  },
  {
    step: "INDUSTRY",
    label: "Industry",
    description: "Select your industry",
  },
  {
    step: "PHONE_SETUP",
    label: "Phone Setup",
    description: "Get your dedicated phone number",
  },
  {
    step: "SUBSCRIPTION",
    label: "Subscription",
    description: "Choose your plan",
  },
  {
    step: "REVIEW",
    label: "Review & Launch",
    description: "Review and go live",
  },
];

/** Tenant as returned by /api/tenant (with relations) */
export interface TenantData {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  logoUrl: string | null;
  description: string | null;
  industry: string | null;
  website: string | null;
  status: TenantStatus;
  onboardingStep: OnboardingStep;
  assignedTwilioNumber: string | null;
  businessPhoneNumber: string | null;
  ivrGreeting: string | null;
  ivrCallbackMessage: string | null;
  ivrAudioUrl: string | null;
  stripeCustomerId: string | null;
  heroMediaUrl: string | null;
  heroMediaType: string | null;
  services: ServiceData[];
  businessHours: BusinessHoursData[];
  subscription: SubscriptionData | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  isActive: boolean;
  sortOrder: number;
  options?: ServiceOptionData[];
}

export interface ServiceOptionData {
  id: string;
  name: string;
  description: string | null;
  duration: number | null;
  price: number | null;
  isActive: boolean;
  sortOrder: number;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  subOptions?: ServiceSubOptionData[];
}

export interface ServiceSubOptionData {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  isActive: boolean;
}

export interface BusinessHoursData {
  id: string;
  day: DayOfWeek;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface SubscriptionData {
  id: string;
  planId: string;
  plan: PlanData;
  status: SubscriptionStatus;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface PlanData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  maxCalls: number;
  maxSms: number;
  maxServices: number;
  maxStaff: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  capabilities: { voice: boolean; sms: boolean };
}

export const INDUSTRIES: { value: string; label: string; category: string }[] = [
  // Automotive
  { value: "auto_repair", label: "Auto Repair", category: "Automotive" },
  { value: "auto_detailing", label: "Auto Detailing", category: "Automotive" },
  { value: "towing", label: "Towing Service", category: "Automotive" },
  { value: "tire_shop", label: "Tire Shop", category: "Automotive" },
  { value: "auto_body", label: "Auto Body Shop", category: "Automotive" },
  // Health & Beauty
  { value: "barbershop", label: "Barbershop", category: "Health & Beauty" },
  { value: "hair_salon", label: "Hair Salon", category: "Health & Beauty" },
  { value: "nail_salon", label: "Nail Salon", category: "Health & Beauty" },
  { value: "spa", label: "Spa & Massage", category: "Health & Beauty" },
  { value: "dental", label: "Dental Clinic", category: "Healthcare" },
  { value: "chiropractic", label: "Chiropractic", category: "Health & Beauty" },
  // Healthcare
  { value: "medical_clinic", label: "Medical Clinic", category: "Healthcare" },
  { value: "pharmacy", label: "Pharmacy", category: "Healthcare" },
  { value: "physiotherapy", label: "Physiotherapy", category: "Healthcare" },
  { value: "optometry", label: "Optometry", category: "Healthcare" },
  { value: "mental_health", label: "Mental Health / Counselling", category: "Healthcare" },
  { value: "veterinary", label: "Veterinary Clinic", category: "Healthcare" },
  // Home Services
  { value: "plumbing", label: "Plumbing", category: "Home Services" },
  { value: "electrical", label: "Electrical", category: "Home Services" },
  { value: "hvac", label: "HVAC", category: "Home Services" },
  { value: "cleaning", label: "Cleaning Service", category: "Home Services" },
  { value: "landscaping", label: "Landscaping", category: "Home Services" },
  { value: "roofing", label: "Roofing", category: "Home Services" },
  // Food & Beverage
  { value: "restaurant", label: "Restaurant", category: "Food & Beverage" },
  { value: "bakery", label: "Bakery", category: "Food & Beverage" },
  { value: "catering", label: "Catering", category: "Food & Beverage" },
  { value: "food_truck", label: "Food Truck", category: "Food & Beverage" },
  // Professional Services
  { value: "law_firm", label: "Law Firm", category: "Professional Services" },
  { value: "accounting", label: "Accounting", category: "Professional Services" },
  { value: "real_estate", label: "Real Estate", category: "Professional Services" },
  { value: "insurance", label: "Insurance", category: "Professional Services" },
  { value: "consulting", label: "Consulting", category: "Professional Services" },
  // Other
  { value: "pet_grooming", label: "Pet Grooming", category: "Other" },
  { value: "photography", label: "Photography", category: "Other" },
  { value: "fitness", label: "Fitness / Gym", category: "Other" },
  { value: "tutoring", label: "Tutoring", category: "Other" },
  { value: "other", label: "Other", category: "Other" },
];

