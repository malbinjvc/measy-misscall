"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingPage } from "@/components/shared/loading";
import { Calendar, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { generateTimeSlots } from "@/lib/utils";

export default function BookingPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    serviceId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    date: "",
    startTime: "",
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/public/shop/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setShop(data.data);
        else setError("Business not found");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/public/shop/${params.slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/shop/${params.slug}/book/confirmation?id=${data.data.id}`);
      } else {
        setError(data.error || "Booking failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingPage />;
  if (error && !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Get min date (today)
  const today = new Date().toISOString().split("T")[0];

  // Get available time slots based on selected date's business hours
  let timeSlots: string[] = [];
  if (form.date) {
    const dayOfWeek = new Date(form.date).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
    const hours = shop?.businessHours?.find((h: any) => h.day === dayOfWeek);
    if (hours?.isOpen) {
      timeSlots = generateTimeSlots(hours.openTime, hours.closeTime, 30);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/shop/${params.slug}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">{shop?.name}</h1>
            <p className="text-sm text-muted-foreground">Book an Appointment</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Book Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}

              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} required>
                  <option value="">Select a service</option>
                  {shop?.services?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration} min{s.price ? ` - $${s.price}` : ""})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, startTime: "" })} required />
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
                {!form.date ? (
                  <p className="text-sm text-muted-foreground">Select a date first</p>
                ) : timeSlots.length === 0 ? (
                  <p className="text-sm text-destructive">Business is closed on this day</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((time) => (
                      <Button
                        key={time}
                        type="button"
                        variant={form.startTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setForm({ ...form, startTime: time })}
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special requests..." />
              </div>

              <Button type="submit" className="w-full" disabled={submitting || !form.startTime}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Book Appointment
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
