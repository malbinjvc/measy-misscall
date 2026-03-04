import { Decimal } from "@prisma/client/runtime/library";

type DecimalLike = number | Decimal | null | undefined;

function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function computeAppointmentPrice(
  appointment: { quantity: number; selectedSubOptions: string[] },
  service: { price: DecimalLike },
  serviceOption: {
    price: DecimalLike;
    subOptions: { id: string; price: DecimalLike }[];
  } | null
): number {
  const servicePrice = toNumber(service.price);
  const optionPrice = toNumber(serviceOption?.price);
  const basePrice = servicePrice + optionPrice;
  const lineTotal = basePrice * appointment.quantity;

  let subTotal = 0;
  if (serviceOption && appointment.selectedSubOptions?.length) {
    for (const subId of appointment.selectedSubOptions) {
      const sub = serviceOption.subOptions.find((s) => s.id === subId);
      if (sub?.price) {
        subTotal += toNumber(sub.price);
      }
    }
  }

  return lineTotal + subTotal;
}

// ─── Multi-item helpers ──────────────────────────────

export interface AppointmentItemForCalc {
  quantity: number;
  selectedSubOptions: string[];
  service: { price: DecimalLike; duration: number };
  serviceOption: {
    price: DecimalLike;
    duration?: number | null;
    subOptions: { id: string; price: DecimalLike }[];
  } | null;
}

export function computeItemPrice(item: AppointmentItemForCalc): number {
  return computeAppointmentPrice(
    { quantity: item.quantity, selectedSubOptions: item.selectedSubOptions },
    item.service,
    item.serviceOption
  );
}

export function computeMultiItemPrice(items: AppointmentItemForCalc[]): number {
  return items.reduce((sum, item) => sum + computeItemPrice(item), 0);
}

export function computeItemDuration(item: AppointmentItemForCalc): number {
  const duration = item.serviceOption?.duration ?? item.service.duration;
  return duration * item.quantity;
}

export function computeMultiItemDuration(items: AppointmentItemForCalc[]): number {
  return items.reduce((sum, item) => sum + computeItemDuration(item), 0);
}
