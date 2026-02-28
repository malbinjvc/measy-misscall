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
    step: "SERVICES",
    label: "Services",
    description: "Add the services you offer",
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

export const DEFAULT_SERVICES = [
  { name: "Tyre Change", duration: 45, price: 80 },
  { name: "Oil Change", duration: 30, price: 50 },
  { name: "Brake Inspection", duration: 60, price: 100 },
  { name: "Brake Pad Replacement", duration: 90, price: 200 },
  { name: "Battery Replacement", duration: 30, price: 150 },
  { name: "Wheel Alignment", duration: 60, price: 75 },
  { name: "AC Service", duration: 60, price: 120 },
  { name: "General Inspection", duration: 45, price: 60 },
];

