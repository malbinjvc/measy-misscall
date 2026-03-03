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
  const basePrice = toNumber(serviceOption?.price) || toNumber(service.price);
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
