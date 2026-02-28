"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingPage } from "@/components/shared/loading";
import { Calendar, Loader2, ArrowLeft, Minus, Plus, Check, X } from "lucide-react";
import Link from "next/link";
import { generateTimeSlots, timeStringToMinutes } from "@/lib/utils";

interface ServiceSubOption {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
}

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  duration: number | null;
  price: number | null;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  subOptions: ServiceSubOption[];
}

interface ServiceWithOptions {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  options: ServiceOption[];
}

interface AvailabilityData {
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
  bookedSlots: { startTime: string; endTime: string }[];
}

// Session storage helpers scoped per shop slug
function getSessionKey(slug: string, key: string) {
  return `booking_${slug}_${key}`;
}

function saveToSession(slug: string, key: string, value: any) {
  try {
    sessionStorage.setItem(getSessionKey(slug, key), JSON.stringify(value));
  } catch {}
}

function loadFromSession<T>(slug: string, key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(getSessionKey(slug, key));
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

export default function BookingPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const preServiceId = searchParams.get("serviceId") || "";
  const preOptionId = searchParams.get("optionId") || "";
  const preQuantity = parseInt(searchParams.get("quantity") || "") || 0;
  const preSubOptions = searchParams.get("subOptions")?.split(",").filter(Boolean) || [];

  // Restore form from session (or use defaults)
  const [form, setForm] = useState(() => {
    // If URL has preselection params, don't restore session (fresh entry from shop page)
    if (preServiceId) {
      return {
        serviceId: preServiceId,
        serviceOptionId: preOptionId,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        date: "",
        startTime: "",
        notes: "",
      };
    }
    return loadFromSession(params.slug, "form", {
      serviceId: "",
      serviceOptionId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: "",
      startTime: "",
      notes: "",
    });
  });

  const [quantity, setQuantity] = useState(() =>
    preServiceId && preOptionId && preQuantity > 0
      ? preQuantity
      : loadFromSession(params.slug, "quantity", 1)
  );
  const [selectedSubOptionIds, setSelectedSubOptionIds] = useState<string[]>(() =>
    preServiceId && preSubOptions.length > 0
      ? preSubOptions
      : loadFromSession(params.slug, "subOptions", [])
  );

  // Availability from server (source of truth for open/closed + booked slots)
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Phone verification — restore from session
  const [verificationCode, setVerificationCode] = useState(() =>
    loadFromSession(params.slug, "verificationCode", "")
  );
  const [phoneVerified, setPhoneVerified] = useState(() =>
    loadFromSession(params.slug, "phoneVerified", false)
  );
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(() =>
    loadFromSession(params.slug, "codeSent", false)
  );
  const [verifiedPhone, setVerifiedPhone] = useState(() =>
    loadFromSession(params.slug, "verifiedPhone", "")
  );
  const [verifyError, setVerifyError] = useState("");

  // Persist form to session on every change
  useEffect(() => { saveToSession(params.slug, "form", form); }, [params.slug, form]);
  useEffect(() => { saveToSession(params.slug, "quantity", quantity); }, [params.slug, quantity]);
  useEffect(() => { saveToSession(params.slug, "subOptions", selectedSubOptionIds); }, [params.slug, selectedSubOptionIds]);
  useEffect(() => { saveToSession(params.slug, "verificationCode", verificationCode); }, [params.slug, verificationCode]);
  useEffect(() => { saveToSession(params.slug, "phoneVerified", phoneVerified); }, [params.slug, phoneVerified]);
  useEffect(() => { saveToSession(params.slug, "codeSent", codeSent); }, [params.slug, codeSent]);
  useEffect(() => { saveToSession(params.slug, "verifiedPhone", verifiedPhone); }, [params.slug, verifiedPhone]);

  // If the phone number changes after verification, reset verification
  useEffect(() => {
    if (phoneVerified && form.customerPhone !== verifiedPhone) {
      setPhoneVerified(false);
      setCodeSent(false);
      setVerificationCode("");
      setVerifiedPhone("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerPhone]);

  // Load shop data
  useEffect(() => {
    fetch(`/api/public/shop/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShop(data.data);
          // Clamp quantity if restoring from session with an option
          if (preServiceId && preOptionId && preQuantity > 0) {
            const svc = data.data.services?.find((s: any) => s.id === preServiceId);
            const opt = svc?.options?.find((o: any) => o.id === preOptionId);
            if (opt) {
              setQuantity(Math.min(Math.max(preQuantity, opt.minQuantity), opt.maxQuantity));
            }
          }
        } else {
          setError("Business not found");
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  // Fetch availability from server when date changes (single source of truth)
  const fetchAvailability = useCallback((date: string) => {
    if (!date || !shop) {
      setAvailability(null);
      return;
    }
    setLoadingSlots(true);
    fetch(`/api/public/shop/${params.slug}/availability?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAvailability(data.data);
        } else {
          setAvailability(null);
        }
      })
      .catch(() => setAvailability(null))
      .finally(() => setLoadingSlots(false));
  }, [params.slug, shop]);

  useEffect(() => {
    fetchAvailability(form.date);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, shop]);

  // Get selected service
  const selectedService: ServiceWithOptions | null = shop?.services?.find(
    (s: any) => s.id === form.serviceId
  ) || null;

  const serviceOptions = selectedService?.options || [];

  // Get selected option
  const selectedOption = serviceOptions.find((o) => o.id === form.serviceOptionId) || null;

  // Time slots computed from server availability data (not local businessHours)
  const timeSlots: string[] = (() => {
    if (!availability || !availability.isOpen || !availability.openTime || !availability.closeTime) {
      return [];
    }
    return generateTimeSlots(availability.openTime, availability.closeTime, 30);
  })();

  // Check if a slot overlaps any booked slot (considering service duration)
  function isSlotBooked(time: string): boolean {
    if (!availability) return false;
    const slotDuration = (selectedOption?.duration ?? selectedService?.duration ?? 30) * (selectedOption ? quantity : 1);
    const slotStart = timeStringToMinutes(time);
    const slotEnd = slotStart + slotDuration;
    return availability.bookedSlots.some((booked) => {
      const bookedStart = timeStringToMinutes(booked.startTime);
      const bookedEnd = timeStringToMinutes(booked.endTime);
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  }

  // Clear error whenever the user interacts with key fields
  function updateForm(updates: Partial<typeof form>) {
    setError("");
    setForm((prev) => ({ ...prev, ...updates }));
  }

  async function handleSendCode() {
    if (!form.customerPhone || form.customerPhone.length < 10) return;
    setSendingCode(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/public/shop/${params.slug}/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.customerPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setCodeSent(true);
      } else {
        setVerifyError(data.error || "Failed to send code");
      }
    } catch {
      setVerifyError("Failed to send verification code");
    } finally {
      setSendingCode(false);
    }
  }

  function handleVerifyCode() {
    if (verificationCode.length !== 6) return;
    setPhoneVerified(true);
    setVerifiedPhone(form.customerPhone);
    setVerifyError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: any = {
        serviceId: form.serviceId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        date: form.date,
        startTime: form.startTime,
        notes: form.notes,
        verificationCode,
      };
      if (form.serviceOptionId) {
        payload.serviceOptionId = form.serviceOptionId;
        payload.quantity = quantity;
        if (selectedSubOptionIds.length > 0) {
          payload.selectedSubOptionIds = selectedSubOptionIds;
        }
      }

      const res = await fetch(`/api/public/shop/${params.slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        // Clear session on successful booking
        ["form", "quantity", "subOptions", "verificationCode", "phoneVerified", "codeSent", "verifiedPhone"].forEach(
          (key) => { try { sessionStorage.removeItem(getSessionKey(params.slug, key)); } catch {} }
        );
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

  // Display info for selected option
  const displayDuration = selectedOption?.duration ?? selectedService?.duration;
  const displayPrice = selectedOption?.price ?? selectedService?.price;

  // Whether the selected date is a closed day (server says not open)
  const isClosedDay = form.date && availability && !availability.isOpen;

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
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-between">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError("")} className="ml-2 shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <Label>Service</Label>
                <Select
                  value={form.serviceId}
                  onChange={(e) => {
                    updateForm({ serviceId: e.target.value, serviceOptionId: "", startTime: "" });
                    setQuantity(1);
                    setSelectedSubOptionIds([]);
                  }}
                  required
                >
                  <option value="">Select a service</option>
                  {shop?.services?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.duration} min{s.price ? ` - $${s.price}` : ""})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Service option selection */}
              {serviceOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Option</Label>
                  <div className="space-y-1.5">
                    {serviceOptions.map((option) => {
                      const isSelected = form.serviceOptionId === option.id;
                      return (
                        <div key={option.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                updateForm({ serviceOptionId: "", startTime: "" });
                                setQuantity(1);
                                setSelectedSubOptionIds([]);
                              } else {
                                updateForm({ serviceOptionId: option.id, startTime: "" });
                                setQuantity(option.defaultQuantity ?? 1);
                                setSelectedSubOptionIds([]);
                              }
                            }}
                            className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? "border-primary" : "border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{option.name}</p>
                              {option.description && (
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {option.price !== null && (
                                <p className="text-sm font-bold text-primary">${option.price}</p>
                              )}
                              {option.duration !== null && (
                                <p className="text-xs text-muted-foreground">{option.duration} min</p>
                              )}
                            </div>
                          </button>

                          {/* Quantity and sub-options for selected option */}
                          {isSelected && (
                            <div className="ml-7 mt-2 space-y-3 pb-1">
                              {/* Quantity controls */}
                              {option.maxQuantity > 1 && (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">Qty:</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => { setQuantity(Math.max(option.minQuantity, quantity - 1)); updateForm({ startTime: "" }); }}
                                      className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                                      disabled={quantity <= option.minQuantity}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => { setQuantity(Math.min(option.maxQuantity, quantity + 1)); updateForm({ startTime: "" }); }}
                                      className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                                      disabled={quantity >= option.maxQuantity}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Sub-option checkboxes */}
                              {option.subOptions && option.subOptions.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-xs text-muted-foreground">Add-ons:</span>
                                  {option.subOptions.map((sub) => {
                                    const isChecked = selectedSubOptionIds.includes(sub.id);
                                    return (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() =>
                                          setSelectedSubOptionIds((prev) =>
                                            isChecked
                                              ? prev.filter((id) => id !== sub.id)
                                              : [...prev, sub.id]
                                          )
                                        }
                                        className={`w-full text-left flex items-center gap-2.5 p-2 rounded-md transition-colors ${
                                          isChecked ? "bg-primary/5" : "hover:bg-gray-50"
                                        }`}
                                      >
                                        <div
                                          className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                            isChecked ? "bg-primary border-primary" : "border-gray-300"
                                          }`}
                                        >
                                          {isChecked && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium">{sub.name}</p>
                                          {sub.description && (
                                            <p className="text-xs text-muted-foreground truncate">{sub.description}</p>
                                          )}
                                        </div>
                                        {sub.price !== null && (
                                          <span className="text-xs font-medium text-primary flex-shrink-0">+${sub.price}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show selected summary with quantity and add-ons */}
              {form.serviceId && (displayDuration || displayPrice) && (
                <div className="rounded-md bg-blue-50 p-3 text-sm space-y-1">
                  <p className="font-medium">{selectedService?.name}{selectedOption ? ` — ${selectedOption.name}` : ""}</p>
                  <p className="text-muted-foreground">
                    {displayDuration && `${displayDuration * (selectedOption ? quantity : 1)} min`}
                    {displayDuration && displayPrice ? " · " : ""}
                    {displayPrice !== null && displayPrice !== undefined && `$${displayPrice}`}
                    {selectedOption && quantity > 1 && ` x ${quantity}`}
                  </p>
                  {selectedOption && selectedSubOptionIds.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedOption.subOptions
                        .filter((s) => selectedSubOptionIds.includes(s.id))
                        .map((s) => (
                          <span key={s.id} className="block">+ {s.name}{s.price ? ` ($${s.price})` : ""}</span>
                        ))}
                    </div>
                  )}
                  {selectedOption && displayPrice !== null && displayPrice !== undefined && (
                    <p className="font-bold text-primary">
                      Total: ${(
                        (displayPrice * quantity) +
                        (selectedOption.subOptions || [])
                          .filter((s) => selectedSubOptionIds.includes(s.id))
                          .reduce((sum, s) => sum + (s.price ?? 0), 0)
                      ).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={form.customerName} onChange={(e) => updateForm({ customerName: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                {phoneVerified ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 border border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">{form.customerPhone} verified</span>
                  </div>
                ) : codeSent ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Code sent to {form.customerPhone}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                      <Button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verificationCode.length !== 6}
                      >
                        Confirm
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline"
                      onClick={() => { setCodeSent(false); setVerificationCode(""); setVerifiedPhone(""); }}
                    >
                      Change number
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      value={form.customerPhone}
                      onChange={(e) => updateForm({ customerPhone: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={sendingCode || form.customerPhone.length < 10}
                    >
                      {sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                )}
                {verifyError && (
                  <p className="text-xs text-destructive">{verifyError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={form.customerEmail} onChange={(e) => updateForm({ customerEmail: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={(e) => updateForm({ date: e.target.value, startTime: "" })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Time</Label>
                {!form.date ? (
                  <p className="text-sm text-muted-foreground">Select a date first</p>
                ) : loadingSlots ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading availability...
                  </div>
                ) : isClosedDay ? (
                  <p className="text-sm text-destructive">Business is closed on this day. Please select another date.</p>
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
                          variant={form.startTime === time ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateForm({ startTime: time })}
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

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} placeholder="Any special requests..." />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  submitting ||
                  !form.startTime ||
                  !phoneVerified ||
                  (serviceOptions.length > 0 && !form.serviceOptionId)
                }
              >
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
