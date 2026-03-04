"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/shared/loading";
import {
  ArrowLeft,
  LogOut,
  Phone,
  Mail,
  Calendar,
  Clock,
  Loader2,
  Check,
  User,
  X,
  CalendarClock,
  Ban,
  Car,
} from "lucide-react";
import { generateTimeSlots, timeStringToMinutes } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────

interface CustomerVehicle {
  id: string;
  vehicleYear: string;
  vehicleType: string | null;
  vehicleMake: string;
  vehicleModel: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  smsConsent: boolean;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  vehicles: CustomerVehicle[];
  createdAt: string;
}

interface CustomerAppointmentItem {
  id: string;
  service: { name: string; duration: number; price: number | null };
  serviceOption: { name: string; duration: number | null; price: number | null } | null;
  quantity: number;
  selectedSubOptions: string[];
  sortOrder: number;
}

interface CustomerAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  service: { name: string; duration: number; price: number | null };
  serviceOption: { name: string; duration: number | null; price: number | null } | null;
  items?: CustomerAppointmentItem[];
}

interface AvailabilityData {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  bookedSlots: { startTime: string; endTime: string }[];
}

// ─── Status Badge ───────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-green-100 text-green-800",
    CONFIRMED: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-[#6040E0]/15 text-[#6040E0]",
    CANCELLED: "bg-red-100 text-red-800",
    NO_SHOW: "bg-gray-100 text-gray-800",
  };

  const labels: Record<string, string> = {
    PENDING: "PROCESSING",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {(labels[status] || status).replace("_", " ")}
    </span>
  );
}

// ─── Login Form ─────────────────────────────────────────

function LoginForm({ slug, onSuccess }: { slug: string; onSuccess: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode() {
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/shop/${slug}/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }
      setStep("code");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/shop/${slug}/customer-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Sign In to Your Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {step === "phone" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="login-phone">Phone Number</Label>
              <Input
                id="login-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="button" onClick={handleSendCode} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
              Send Verification Code
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <strong>{phone}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="otp-code">Verification Code</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="button" onClick={handleVerify} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Verify & Sign In
            </Button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              className="text-sm text-primary hover:underline"
            >
              Use a different number
            </button>
          </>
        )}
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Reschedule Dialog ──────────────────────────────────

function RescheduleDialog({
  slug,
  appointment,
  onClose,
  onRescheduled,
}: {
  slug: string;
  appointment: CustomerAppointment;
  onClose: () => void;
  onRescheduled: (updated: CustomerAppointment) => void;
}) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch availability when date changes
  useEffect(() => {
    if (!date) { setAvailability(null); return; }
    setLoadingSlots(true);
    setStartTime("");
    fetch(`/api/public/shop/${slug}/availability?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAvailability(data.data);
        else setAvailability(null);
      })
      .catch(() => setAvailability(null))
      .finally(() => setLoadingSlots(false));
  }, [date, slug]);

  // Use items-based duration when available, fallback to legacy single service
  const serviceDuration = appointment.items && appointment.items.length > 0
    ? appointment.items.reduce((sum, item) => sum + ((item.serviceOption?.duration ?? item.service.duration) * item.quantity), 0)
    : (appointment.serviceOption?.duration ?? appointment.service.duration);

  const timeSlots = (() => {
    if (!availability?.isOpen || !availability.openTime || !availability.closeTime) return [];
    return generateTimeSlots(availability.openTime, availability.closeTime, 30);
  })();

  function isSlotBooked(time: string): boolean {
    if (!availability) return false;
    const slotStart = timeStringToMinutes(time);
    const slotEnd = slotStart + serviceDuration;
    return availability.bookedSlots.some((booked) => {
      const bookedStart = timeStringToMinutes(booked.startTime);
      const bookedEnd = timeStringToMinutes(booked.endTime);
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  }

  async function handleReschedule() {
    if (!date || !startTime) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/shop/${slug}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          action: "reschedule",
          date,
          startTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRescheduled(data.data);
      } else {
        setError(data.error || "Reschedule failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5" />
            Reschedule Appointment
          </CardTitle>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-blue-50 p-3 text-sm">
            {appointment.items && appointment.items.length > 0 ? (
              <div className="space-y-1">
                {appointment.items.map((item, idx) => (
                  <div key={item.id}>
                    <p className={`font-medium ${idx > 0 ? "pt-1" : ""}`}>{item.service.name}</p>
                    {item.serviceOption && (
                      <p className="text-xs text-muted-foreground">{item.serviceOption.name}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="font-medium">{appointment.service.name}</p>
                {appointment.serviceOption && (
                  <p className="text-xs text-muted-foreground">{appointment.serviceOption.name}</p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground mt-1">{serviceDuration} min</p>
          </div>

          <div className="space-y-2">
            <Label>New Date</Label>
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>New Time</Label>
            {!date ? (
              <p className="text-sm text-muted-foreground">Select a date first</p>
            ) : loadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : availability && !availability.isOpen ? (
              <p className="text-sm text-red-600">Business is closed on this day</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No time slots available</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => {
                  const booked = isSlotBooked(time);
                  return (
                    <Button
                      key={time}
                      type="button"
                      variant={startTime === time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStartTime(time)}
                      disabled={booked}
                      className={booked ? "opacity-40 line-through" : ""}
                    >
                      {time}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button
              onClick={handleReschedule}
              disabled={loading || !date || !startTime}
              className="flex-1"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Confirm Reschedule
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Profile View ───────────────────────────────────────

function ProfileView({
  slug,
  customer,
  appointments,
  onLogout,
  onUpdate,
  onAppointmentsChange,
}: {
  slug: string;
  customer: CustomerProfile;
  appointments: CustomerAppointment[];
  onLogout: () => void;
  onUpdate: (updated: CustomerProfile) => void;
  onAppointmentsChange: (updated: CustomerAppointment[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email || "");
  const [saving, setSaving] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<CustomerAppointment | null>(null);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/public/shop/${slug}/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || "" }),
      });
      const data = await res.json();
      if (res.ok && data.data) {
        onUpdate(data.data);
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await fetch(`/api/public/shop/${slug}/customer-auth`, { method: "DELETE" });
      onLogout();
    } catch {
      // ignore
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleCancel(aptId: string) {
    setCancellingId(aptId);
    try {
      const res = await fetch(`/api/public/shop/${slug}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: aptId, action: "cancel" }),
      });
      const data = await res.json();
      if (data.success) {
        onAppointmentsChange(
          appointments.map((a) => (a.id === aptId ? { ...a, status: "CANCELLED" } : a))
        );
      }
    } catch {
      // ignore
    } finally {
      setCancellingId(null);
    }
  }

  function handleRescheduled(updated: CustomerAppointment) {
    onAppointmentsChange(
      appointments.map((a) => (a.id === updated.id ? updated : a))
    );
    setRescheduleApt(null);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    return new Date(year, month, day).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const canModify = (status: string) => ["PENDING", "CONFIRMED"].includes(status);

  return (
    <div className="space-y-6">
      {/* Reschedule Dialog */}
      {rescheduleApt && (
        <RescheduleDialog
          slug={slug}
          appointment={rescheduleApt}
          onClose={() => setRescheduleApt(null)}
          onRescheduled={handleRescheduled}
        />
      )}

      {/* Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            My Profile
          </CardTitle>
          <div className="flex gap-2">
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={logoutLoading}>
              {logoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setName(customer.name); setEmail(customer.email || ""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.vehicles && customer.vehicles.length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Car className="h-3 w-3" /> Saved Vehicles
                  </p>
                  {customer.vehicles.map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-sm pl-5">
                      <span>{v.vehicleYear} {v.vehicleMake} {v.vehicleModel}</span>
                      {v.vehicleType && <span className="text-xs text-muted-foreground">({v.vehicleType})</span>}
                    </div>
                  ))}
                </div>
              )}
              {!customer.vehicles?.length && customer.vehicleMake && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Car className="h-4 w-4" />
                  <span>{[customer.vehicleYear, customer.vehicleMake, customer.vehicleModel].filter(Boolean).join(" ")}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Appointments ({appointments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No appointments yet</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {apt.items && apt.items.length > 0 ? (
                        <div>
                          {apt.items.map((item, idx) => (
                            <div key={item.id}>
                              <p className={`font-medium text-sm ${idx > 0 ? "mt-0.5" : ""}`}>{item.service.name}</p>
                              {item.serviceOption && (
                                <p className="text-xs text-muted-foreground">{item.serviceOption.name}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-sm">{apt.service.name}</p>
                          {apt.serviceOption && (
                            <p className="text-xs text-muted-foreground">{apt.serviceOption.name}</p>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(apt.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {apt.startTime} - {apt.endTime}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  {canModify(apt.status) && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setRescheduleApt(apt)}
                      >
                        <CalendarClock className="h-3 w-3 mr-1" />
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleCancel(apt.id)}
                        disabled={cancellingId === apt.id}
                      >
                        {cancellingId === apt.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Ban className="h-3 w-3 mr-1" />
                        )}
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function CustomerAccountPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/shop/${slug}/account`, { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCustomer(data.data.customer);
        setAppointments(data.data.appointments);
        setAuthenticated(true);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/shop/${slug}`} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold">My Account</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {authenticated && customer ? (
          <ProfileView
            slug={slug}
            customer={customer}
            appointments={appointments}
            onLogout={() => {
              setAuthenticated(false);
              setCustomer(null);
              setAppointments([]);
            }}
            onUpdate={(updated) => setCustomer(updated)}
            onAppointmentsChange={(updated) => setAppointments(updated)}
          />
        ) : (
          <LoginForm slug={slug} onSuccess={loadProfile} />
        )}
      </main>
    </div>
  );
}
