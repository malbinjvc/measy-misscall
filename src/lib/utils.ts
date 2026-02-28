import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a phone number to E.164 format (e.g. "+13656543756").
 * Strips spaces, dashes, parentheses and other formatting characters.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Keep only digits and leading +
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized || null;
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const APP_TIMEZONE = "America/Toronto";

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(new Date(date));
}

/**
 * Format a date-only value stored as UTC midnight (e.g. appointment dates).
 * Shifts to noon UTC before formatting so the Toronto timezone offset
 * (UTC-5 / UTC-4) doesn't roll the date back to the previous day.
 */
export function formatDateUTC(date: Date | string): string {
  const d = new Date(date);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) {
    d.setUTCHours(12);
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(date));
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function getShopUrl(slug: string): string {
  return `${getBaseUrl()}/shop/${slug}`;
}

export function getBookingUrl(slug: string): string {
  return `${getBaseUrl()}/shop/${slug}/book`;
}

export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  let current = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);

  while (current < end) {
    slots.push(minutesToTimeString(current));
    current += intervalMinutes;
  }

  return slots;
}
