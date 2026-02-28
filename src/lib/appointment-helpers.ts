export function computeAppointmentPrice(
  appointment: { quantity: number; selectedSubOptions: string[] },
  service: { price: number | null },
  serviceOption: {
    price: number | null;
    subOptions: { id: string; price: number | null }[];
  } | null
): number {
  const basePrice = serviceOption?.price ?? service.price ?? 0;
  const lineTotal = basePrice * appointment.quantity;

  let subTotal = 0;
  if (serviceOption && appointment.selectedSubOptions?.length) {
    for (const subId of appointment.selectedSubOptions) {
      const sub = serviceOption.subOptions.find((s) => s.id === subId);
      if (sub?.price) {
        subTotal += sub.price;
      }
    }
  }

  return lineTotal + subTotal;
}
