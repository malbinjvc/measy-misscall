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
import { Calendar, Loader2, ArrowLeft, Minus, Plus, Check, X, Car, Trash2 } from "lucide-react";
import Link from "next/link";
import { generateTimeSlots, timeStringToMinutes } from "@/lib/utils";

const AUTO_INDUSTRIES = ["auto_repair", "auto_detailing", "towing", "tire_shop", "auto_body"];

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

interface BookingItem {
  id: string; // local key
  serviceId: string;
  serviceOptionId: string;
  quantity: number;
  selectedSubOptionIds: string[];
}

let bookingItemCounter = 0;
function newBookingItemId() { return `bi-${++bookingItemCounter}`; }

// Session storage helpers scoped per shop slug
function getSessionKey(slug: string, key: string) {
  return `booking_${slug}_${key}`;
}

function saveToSession(slug: string, key: string, value: unknown) {
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
  interface ShopData {
    name: string;
    industry: string | null;
    services: ServiceWithOptions[];
  }
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const preServiceId = searchParams.get("serviceId") || "";
  const preOptionId = searchParams.get("optionId") || "";
  const preQuantity = parseInt(searchParams.get("quantity") || "") || 0;
  const preSubOptions = searchParams.get("subOptions")?.split(",").filter(Boolean) || [];

  // Multi-item cart state
  const [items, setItems] = useState<BookingItem[]>(() => {
    if (preServiceId) {
      return [{ id: newBookingItemId(), serviceId: preServiceId, serviceOptionId: preOptionId, quantity: preQuantity || 1, selectedSubOptionIds: preSubOptions }];
    }
    return loadFromSession(params.slug, "items", [{ id: newBookingItemId(), serviceId: "", serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] as string[] }]);
  });

  // Restore form from session (or use defaults)
  const [form, setForm] = useState(() => {
    if (preServiceId) {
      return {
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        date: "",
        startTime: "",
        notes: "",
        vehicleYear: "",
        vehicleType: "",
        vehicleMake: "",
        vehicleModel: "",
        appointmentPreference: "",
      };
    }
    return loadFromSession(params.slug, "form", {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      date: "",
      startTime: "",
      notes: "",
      vehicleYear: "",
      vehicleType: "",
      vehicleMake: "",
      vehicleModel: "",
      appointmentPreference: "",
    });
  });

  const [smsConsent, setSmsConsent] = useState(false);

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

  // Logged-in customer phone (from customer auth cookie)
  const [loggedInPhone, setLoggedInPhone] = useState<string | null>(null);

  // Saved vehicles from customer account
  interface SavedVehicle {
    id: string;
    vehicleYear: string;
    vehicleType: string | null;
    vehicleMake: string;
    vehicleModel: string;
  }
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Check if customer is logged in and fetch their phone + saved vehicles
  useEffect(() => {
    fetch(`/api/public/shop/${params.slug}/account`, { cache: "no-store" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.success && data.data?.customer) {
          const c = data.data.customer;
          if (c.phone) {
            setLoggedInPhone(c.phone);
            // Auto-fill form fields from logged-in customer
            setForm((prev) => ({
              ...prev,
              customerPhone: prev.customerPhone || c.phone,
              customerName: prev.customerName || c.name || "",
              customerEmail: prev.customerEmail || c.email || "",
            }));
            // Auto-verify immediately if phone was filled
            setPhoneVerified(true);
            setVerifiedPhone(c.phone);
          }
          if (c.vehicles?.length) {
            setSavedVehicles(c.vehicles);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  // Auto-verify phone if it matches the logged-in customer's phone
  // Compare last 10 digits to handle country code differences (+1 prefix)
  useEffect(() => {
    if (loggedInPhone && form.customerPhone && !phoneVerified) {
      const last10 = (p: string) => p.replace(/\D/g, "").slice(-10);
      if (last10(form.customerPhone).length === 10 && last10(form.customerPhone) === last10(loggedInPhone)) {
        setPhoneVerified(true);
        setVerifiedPhone(form.customerPhone);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerPhone, loggedInPhone, phoneVerified]);

  // Vehicle data from NHTSA API
  const [vehicleMakes, setVehicleMakes] = useState<string[]>([]);
  const [vehicleModels, setVehicleModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [makesFallback, setMakesFallback] = useState(false);
  const [modelsFallback, setModelsFallback] = useState(false);

  const isAutoIndustry = shop?.industry ? AUTO_INDUSTRIES.includes(shop.industry) : false;

  // Fetch vehicle makes when year or type changes
  useEffect(() => {
    if (!form.vehicleYear || !form.vehicleType || !isAutoIndustry) {
      setVehicleMakes([]);
      setMakesFallback(false);
      return;
    }
    setLoadingMakes(true);
    setMakesFallback(false);
    fetch(`/api/public/vehicle-data?type=makes&vehicleType=${encodeURIComponent(form.vehicleType)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVehicleMakes(data.data);
        } else {
          throw new Error("API error");
        }
      })
      .catch(() => {
        setVehicleMakes([]);
        setMakesFallback(true);
      })
      .finally(() => setLoadingMakes(false));
  }, [form.vehicleYear, form.vehicleType, isAutoIndustry]);

  // Fetch vehicle models when year + make changes
  useEffect(() => {
    if (!form.vehicleYear || !form.vehicleMake || !isAutoIndustry) {
      setVehicleModels([]);
      setModelsFallback(false);
      return;
    }
    setLoadingModels(true);
    setModelsFallback(false);
    fetch(`/api/public/vehicle-data?type=models&year=${form.vehicleYear}&make=${encodeURIComponent(form.vehicleMake)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setVehicleModels(data.data);
        } else {
          throw new Error("API error");
        }
      })
      .catch(() => {
        setVehicleModels([]);
        setModelsFallback(true);
      })
      .finally(() => setLoadingModels(false));
  }, [form.vehicleYear, form.vehicleMake, isAutoIndustry]);

  // Persist form to session on every change
  useEffect(() => { saveToSession(params.slug, "form", form); }, [params.slug, form]);
  useEffect(() => { saveToSession(params.slug, "items", items); }, [params.slug, items]);
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
            const svc = data.data.services?.find((s: ServiceWithOptions) => s.id === preServiceId);
            const opt = svc?.options?.find((o: ServiceOption) => o.id === preOptionId);
            if (opt) {
              setItems((prev) => prev.map((item) =>
                item.serviceId === preServiceId ? { ...item, quantity: Math.min(Math.max(preQuantity, opt.minQuantity), opt.maxQuantity) } : item
              ));
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

  // Cart item helpers
  function updateItem(itemId: string, updates: Partial<BookingItem>) {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, ...updates } : item));
    updateForm({ startTime: "" }); // Reset time when items change
  }

  function addItem() {
    setItems((prev) => [...prev, { id: newBookingItemId(), serviceId: "", serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] }]);
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    updateForm({ startTime: "" });
  }

  // Compute aggregate duration across all items
  const aggregateDuration = items.reduce((total, item) => {
    const svc = shop?.services?.find((s: ServiceWithOptions) => s.id === item.serviceId);
    if (!svc) return total;
    const opt = svc.options?.find((o: ServiceOption) => o.id === item.serviceOptionId);
    const dur = opt?.duration ?? svc.duration;
    return total + dur * (item.quantity || 1);
  }, 0);

  const hasValidItem = items.some((item) => item.serviceId);

  // Time slots computed from server availability data
  const timeSlots: string[] = (() => {
    if (!availability || !availability.isOpen || !availability.openTime || !availability.closeTime) {
      return [];
    }
    return generateTimeSlots(availability.openTime, availability.closeTime, 30);
  })();

  // Check if a slot overlaps any booked slot (considering aggregate duration)
  function isSlotBooked(time: string): boolean {
    if (!availability) return false;
    const slotStart = timeStringToMinutes(time);
    const slotEnd = slotStart + (aggregateDuration || 30);
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

  const [verifying, setVerifying] = useState(false);

  async function handleVerifyCode() {
    if (verificationCode.length !== 6) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/public/shop/${params.slug}/verify-phone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.customerPhone, code: verificationCode }),
      });
      const data = await res.json();
      if (data.success) {
        setPhoneVerified(true);
        setVerifiedPhone(form.customerPhone);
      } else {
        setVerifyError(data.error || "Invalid or expired code");
      }
    } catch {
      setVerifyError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const bookingItems = items
        .filter((item) => item.serviceId)
        .map((item) => ({
          serviceId: item.serviceId,
          serviceOptionId: item.serviceOptionId || undefined,
          quantity: item.quantity,
          selectedSubOptionIds: item.selectedSubOptionIds.length > 0 ? item.selectedSubOptionIds : undefined,
        }));

      const payload: Record<string, unknown> = {
        items: bookingItems,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail,
        date: form.date,
        startTime: form.startTime,
        notes: form.notes,
        ...(verificationCode ? { verificationCode } : {}),
      };
      if (form.vehicleYear) payload.vehicleYear = form.vehicleYear;
      if (form.vehicleType) payload.vehicleType = form.vehicleType;
      if (form.vehicleMake) payload.vehicleMake = form.vehicleMake;
      if (form.vehicleModel) payload.vehicleModel = form.vehicleModel;
      if (form.appointmentPreference) payload.appointmentPreference = form.appointmentPreference;
      payload.smsConsent = smsConsent;

      const res = await fetch(`/api/public/shop/${params.slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        // Clear session on successful booking
        ["form", "items", "verificationCode", "phoneVerified", "codeSent", "verifiedPhone"].forEach(
          (key) => { try { sessionStorage.removeItem(getSessionKey(params.slug, key)); } catch {} }
        );
        router.push(`/shop/${params.slug}/book/confirmation?id=${data.data.id}`);
      } else {
        // If OTP was consumed but booking failed, reset verification so user can re-verify
        if (data.error?.toLowerCase().includes("verification code")) {
          setPhoneVerified(false);
          setCodeSent(false);
          setVerificationCode("");
          setVerifiedPhone("");
        }
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

  // Get min date (today in local timezone — toISOString() uses UTC which shifts the date)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Whether the selected date is a closed day (server says not open)
  const isClosedDay = form.date && availability && !availability.isOpen;

  // Compute aggregate price across all items
  const aggregatePrice = items.reduce((total, item) => {
    const svc = shop?.services?.find((s: ServiceWithOptions) => s.id === item.serviceId);
    if (!svc) return total;
    const opt = svc.options?.find((o: ServiceOption) => o.id === item.serviceOptionId);
    const servicePrice = Number(svc.price ?? 0);
    const optionPrice = Number(opt?.price ?? 0);
    const basePrice = servicePrice + optionPrice;
    let itemTotal = basePrice * (item.quantity || 1);
    // Add sub-option prices
    if (opt && item.selectedSubOptionIds.length > 0) {
      for (const subId of item.selectedSubOptionIds) {
        const sub = opt.subOptions?.find((s: ServiceSubOption) => s.id === subId);
        if (sub?.price) itemTotal += Number(sub.price);
      }
    }
    return total + itemTotal;
  }, 0);

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

              {/* Cart Items */}
              {items.map((item, idx) => {
                const svc = shop?.services?.find((s: ServiceWithOptions) => s.id === item.serviceId) || null;
                const svcOptions = svc?.options || [];
                const selectedOpt = svcOptions.find((o: ServiceOption) => o.id === item.serviceOptionId) || null;

                return (
                  <div key={item.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Service{items.length > 1 ? ` #${idx + 1}` : ""}</Label>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Select
                      value={item.serviceId}
                      onChange={(e) => updateItem(item.id, { serviceId: e.target.value, serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] })}
                      required={idx === 0}
                    >
                      <option value="">Select a service</option>
                      {shop?.services?.map((s: ServiceWithOptions) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.duration} min{s.price ? ` - $${s.price}` : ""})
                        </option>
                      ))}
                    </Select>

                    {/* Service option selection */}
                    {svcOptions.length > 0 && (
                      <div className="space-y-1.5">
                        {svcOptions.map((option: ServiceOption) => {
                          const isSelected = item.serviceOptionId === option.id;
                          return (
                            <div key={option.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    updateItem(item.id, { serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] });
                                  } else {
                                    updateItem(item.id, { serviceOptionId: option.id, quantity: option.defaultQuantity ?? 1, selectedSubOptionIds: [] });
                                  }
                                }}
                                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                  isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-primary" : "border-gray-300"}`}>
                                  {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{option.name}</p>
                                  {option.description && <p className="text-xs text-muted-foreground">{option.description}</p>}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {option.price !== null && <p className="text-sm font-bold text-primary">${option.price}</p>}
                                  {option.duration !== null && <p className="text-xs text-muted-foreground">{option.duration} min</p>}
                                </div>
                              </button>

                              {isSelected && (
                                <div className="ml-7 mt-2 space-y-3 pb-1">
                                  {option.maxQuantity > 1 && (
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-muted-foreground">Qty:</span>
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => updateItem(item.id, { quantity: Math.max(option.minQuantity, item.quantity - 1) })} className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40" disabled={item.quantity <= option.minQuantity}><Minus className="h-3 w-3" /></button>
                                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                                        <button type="button" onClick={() => updateItem(item.id, { quantity: Math.min(option.maxQuantity, item.quantity + 1) })} className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40" disabled={item.quantity >= option.maxQuantity}><Plus className="h-3 w-3" /></button>
                                      </div>
                                    </div>
                                  )}

                                  {option.subOptions && option.subOptions.length > 0 && (
                                    <div className="space-y-1.5">
                                      <span className="text-xs text-muted-foreground">Add-ons:</span>
                                      {option.subOptions.map((sub: ServiceSubOption) => {
                                        const isChecked = item.selectedSubOptionIds.includes(sub.id);
                                        return (
                                          <button key={sub.id} type="button" onClick={() => updateItem(item.id, { selectedSubOptionIds: isChecked ? item.selectedSubOptionIds.filter((id) => id !== sub.id) : [...item.selectedSubOptionIds, sub.id] })} className={`w-full text-left flex items-center gap-2.5 p-2 rounded-md transition-colors ${isChecked ? "bg-primary/5" : "hover:bg-gray-50"}`}>
                                            <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? "bg-primary border-primary" : "border-gray-300"}`}>
                                              {isChecked && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium">{sub.name}</p>
                                              {sub.description && <p className="text-xs text-muted-foreground truncate">{sub.description}</p>}
                                            </div>
                                            {sub.price !== null && <span className="text-xs font-medium text-primary flex-shrink-0">+${sub.price}</span>}
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
                    )}
                  </div>
                );
              })}

              {/* Add another service button */}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Another Service
              </Button>

              {/* Summary */}
              {hasValidItem && (aggregateDuration > 0 || aggregatePrice > 0) && (
                <div className="rounded-md bg-blue-50 p-3 text-sm space-y-1">
                  {items.filter((item) => item.serviceId).map((item) => {
                    const svc = shop?.services?.find((s: ServiceWithOptions) => s.id === item.serviceId);
                    const opt = svc?.options?.find((o: ServiceOption) => o.id === item.serviceOptionId);
                    if (!svc) return null;
                    const dur = opt?.duration ?? svc.duration;
                    const price = Number(svc.price ?? 0) + Number(opt?.price ?? 0);
                    return (
                      <div key={item.id}>
                        <p className="font-medium">{svc.name}{opt ? ` — ${opt.name}` : ""}</p>
                        <p className="text-muted-foreground text-xs">
                          {dur * (item.quantity || 1)} min
                          {price != null ? ` · $${price}` : ""}
                          {item.quantity > 1 ? ` x ${item.quantity}` : ""}
                        </p>
                      </div>
                    );
                  })}
                  <div className="pt-1 border-t mt-1">
                    <p className="text-muted-foreground">{aggregateDuration} min total</p>
                    {aggregatePrice > 0 && (
                      <p className="font-bold text-primary">Total: ${aggregatePrice.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle Info & Appointment Preference (auto industries only) */}
              {isAutoIndustry && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Car className="h-4 w-4" /> Vehicle Information
                  </div>

                  {savedVehicles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Saved Vehicles</Label>
                      <Select
                        value={selectedVehicleId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedVehicleId(id);
                          if (id === "") {
                            updateForm({ vehicleYear: "", vehicleType: "", vehicleMake: "", vehicleModel: "" });
                          } else {
                            const v = savedVehicles.find((sv) => sv.id === id);
                            if (v) {
                              updateForm({
                                vehicleYear: v.vehicleYear,
                                vehicleType: v.vehicleType || "",
                                vehicleMake: v.vehicleMake,
                                vehicleModel: v.vehicleModel,
                              });
                            }
                          }
                        }}
                      >
                        <option value="">Enter new vehicle</option>
                        {savedVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.vehicleYear} {v.vehicleMake} {v.vehicleModel}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select
                      value={form.vehicleYear}
                      onChange={(e) => { setSelectedVehicleId(""); updateForm({ vehicleYear: e.target.value, vehicleType: "", vehicleMake: "", vehicleModel: "" }); }}
                    >
                      <option value="">Select year</option>
                      {Array.from({ length: new Date().getFullYear() - 1990 + 1 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                        <option key={yr} value={String(yr)}>{yr}</option>
                      ))}
                    </Select>
                  </div>

                  {form.vehicleYear && (
                    <div className="space-y-2">
                      <Label>Vehicle Type</Label>
                      <Select
                        value={form.vehicleType}
                        onChange={(e) => updateForm({ vehicleType: e.target.value, vehicleMake: "", vehicleModel: "" })}
                      >
                        <option value="">Select type</option>
                        <option value="car">Car</option>
                        <option value="truck">Truck</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="motorcycle">Motorcycle</option>
                      </Select>
                    </div>
                  )}

                  {form.vehicleYear && form.vehicleType && (
                    <div className="space-y-2">
                      <Label>Make</Label>
                      {loadingMakes ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading makes...
                        </div>
                      ) : makesFallback ? (
                        <Input
                          placeholder="Enter vehicle make (e.g. Toyota)"
                          value={form.vehicleMake}
                          onChange={(e) => updateForm({ vehicleMake: e.target.value, vehicleModel: "" })}
                        />
                      ) : (
                        <Select
                          value={form.vehicleMake}
                          onChange={(e) => updateForm({ vehicleMake: e.target.value, vehicleModel: "" })}
                        >
                          <option value="">Select make</option>
                          {vehicleMakes.map((make) => (
                            <option key={make} value={make}>{make}</option>
                          ))}
                        </Select>
                      )}
                    </div>
                  )}

                  {form.vehicleYear && form.vehicleType && form.vehicleMake && (
                    <div className="space-y-2">
                      <Label>Model</Label>
                      {loadingModels ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading models...
                        </div>
                      ) : modelsFallback ? (
                        <Input
                          placeholder="Enter vehicle model (e.g. Camry)"
                          value={form.vehicleModel}
                          onChange={(e) => updateForm({ vehicleModel: e.target.value })}
                        />
                      ) : (
                        <Select
                          value={form.vehicleModel}
                          onChange={(e) => updateForm({ vehicleModel: e.target.value })}
                        >
                          <option value="">Select model</option>
                          {vehicleModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </Select>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t">
                    <Label>Appointment Preference</Label>
                    <div className="space-y-1.5">
                      {([
                        { value: "DROP_OFF", label: "Drop off vehicle" },
                        { value: "WAIT_FOR_IT", label: "Wait at shop" },
                        { value: "PICKUP_DROPOFF", label: "Request Pick-up/Drop-off" },
                      ] as const).map(({ value, label }) => {
                        const isSelected = form.appointmentPreference === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateForm({ appointmentPreference: isSelected ? "" : value })}
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
                            <span className="text-sm font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input value={form.customerName} onChange={(e) => updateForm({ customerName: e.target.value })} required />
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                {phoneVerified ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded-md bg-green-50 border border-green-200">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">{form.customerPhone} verified</span>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-primary underline"
                      onClick={() => {
                        setPhoneVerified(false);
                        setCodeSent(false);
                        setVerificationCode("");
                        setVerifiedPhone("");
                        updateForm({ customerPhone: "" });
                      }}
                    >
                      Book for a different number?
                    </button>
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
                        disabled={verificationCode.length !== 6 || verifying}
                      >
                        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
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
                  <div className="space-y-2">
                    {loggedInPhone && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 p-2 rounded-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors text-sm text-blue-700"
                        onClick={() => {
                          updateForm({ customerPhone: loggedInPhone });
                          setPhoneVerified(true);
                          setVerifiedPhone(loggedInPhone);
                        }}
                      >
                        <Check className="h-4 w-4" />
                        Use my number ({loggedInPhone})
                      </button>
                    )}
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
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected < today) {
                      setError("Please select today or a future date");
                      return;
                    }
                    setError("");
                    updateForm({ date: selected, startTime: "" });
                  }}
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

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="sms-consent"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 accent-primary shrink-0"
                />
                <label htmlFor="sms-consent" className="text-xs text-muted-foreground leading-relaxed">
                  By providing my phone number and submitting this form, I consent to receive SMS text messages from{" "}
                  <span className="font-medium text-foreground">{shop?.name}</span>{" "}
                  regarding my appointment request, confirmations, reminders, and service updates. Message and data rates may apply. Message frequency may vary. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase. See the Measy{" "}
                  <a href="https://measy.ca/pages/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:opacity-80">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="https://measy.ca/pages/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:opacity-80">Terms of Service</a>{" "}
                  for details on how your information is used.
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  submitting ||
                  !form.startTime ||
                  !phoneVerified ||
                  !hasValidItem
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
