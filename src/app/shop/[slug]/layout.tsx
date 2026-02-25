import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Appointment | Measy MissCall",
  description: "Book an appointment or submit feedback online.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
