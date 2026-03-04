"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingPage } from "@/components/shared/loading";
import {
  Phone,
  MapPin,
  Clock,
  Calendar,
  Star,
  Menu,
  X,
  MessageCircle,
  Send,
  ChevronRight,
  ChevronDown,
  Wrench,
  Image as ImageIcon,
  Loader2,
  Minus,
  Plus as PlusIcon,
  Check,
  User,
} from "lucide-react";
import DOMPurify from "dompurify";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";

// ─── Types ──────────────────────────────────────────────

interface ShopData {
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  logoUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  heroMediaUrl: string | null;
  heroMediaType: string | null;
  websiteConfig: WebsiteConfigType | null;
  services: Service[];
  businessHours: BusinessHour[];
  reviews: Review[];
  averageRating: number;
  reviewCount: number;
  hasAiChat: boolean;
}

// ─── Website Config Types (inline for public page) ──────

interface TextConfigType {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  alignment: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  textShadow?: { enabled: boolean; x: number; y: number; blur: number; color: string };
  gradient?: { enabled: boolean; from: string; to: string; direction: string };
}

interface CtaConfigType {
  enabled: boolean;
  text: string;
  url: string;
}

interface OverlayConfigType {
  color: string;
  opacity: number;
}

interface WebsiteSectionBase {
  id: string;
  visible: boolean;
}

interface HeroSectionType extends WebsiteSectionBase {
  type: "hero";
  mediaUrl: string | null;
  mediaType: "image" | "video";
  headline: TextConfigType;
  subtitle: TextConfigType;
  cta: CtaConfigType;
  overlay: OverlayConfigType;
  minHeight: number;
}

interface ReviewsSectionType extends WebsiteSectionBase {
  type: "reviews";
  title: TextConfigType;
}

interface ServicesSectionType extends WebsiteSectionBase {
  type: "services";
  title: TextConfigType;
}

interface AboutSectionType extends WebsiteSectionBase {
  type: "about";
  title: TextConfigType;
  body: TextConfigType;
}

interface TextBlockSectionType extends WebsiteSectionBase {
  type: "text-block";
  title: TextConfigType;
  body: TextConfigType;
  backgroundColor: string;
  padding: number;
}

interface MediaBlockSectionType extends WebsiteSectionBase {
  type: "media-block";
  mediaUrl: string | null;
  mediaType: "image" | "video";
  caption: TextConfigType;
  aspectRatio: string;
}

interface TextOverMediaSectionType extends WebsiteSectionBase {
  type: "text-over-media";
  mediaUrl: string | null;
  mediaType: "image" | "video";
  headline: TextConfigType;
  subtitle: TextConfigType;
  cta: CtaConfigType;
  overlay: OverlayConfigType;
  minHeight: number;
}

// ─── Element Types (inside custom sections) ──────────

interface TextElementType {
  type: "text";
  id: string;
  title: TextConfigType;
  body: TextConfigType;
}

interface MediaElementType {
  type: "media";
  id: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  caption: TextConfigType;
  aspectRatio: string;
}

interface TextOverMediaElementType {
  type: "text-over-media";
  id: string;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  headline: TextConfigType;
  subtitle: TextConfigType;
  cta: CtaConfigType;
  overlay: OverlayConfigType;
  minHeight: number;
}

type SectionElementType = TextElementType | MediaElementType | TextOverMediaElementType;

interface CustomSectionType extends WebsiteSectionBase {
  type: "custom";
  name: string;
  backgroundColor: string;
  padding: number;
  elements: SectionElementType[];
}

type WebsiteSectionType =
  | HeroSectionType
  | ReviewsSectionType
  | ServicesSectionType
  | AboutSectionType
  | TextBlockSectionType
  | MediaBlockSectionType
  | TextOverMediaSectionType
  | CustomSectionType;

interface NavBarConfigType {
  logoUrl: string | null;
  logoType: "image" | "gif" | "video";
  logoHeight: number;
  showName: boolean;
}

interface WebsiteConfigType {
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    backgroundColor: string;
  };
  navBar?: NavBarConfigType;
  sections: WebsiteSectionType[];
}

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

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  sortOrder: number;
  options: ServiceOption[];
}

interface BusinessHour {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  imageUrl: string | null;
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Main Page ──────────────────────────────────────────

export default function ShopPage({ params }: { params: { slug: string } }) {
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/public/shop/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShop(data.data);
        } else {
          setError("Business not found");
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) return <LoadingPage />;
  if (error || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Business Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // If websiteConfig exists, render the configured page
  if (shop.websiteConfig) {
    return (
      <ConfiguredShopPage
        shop={shop}
        config={shop.websiteConfig}
        slug={params.slug}
        reviewModalOpen={reviewModalOpen}
        setReviewModalOpen={setReviewModalOpen}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <ShopHeader
        name={shop.name}
        slug={params.slug}
        phone={shop.phone}
        address={[shop.address, shop.city, shop.state, shop.zipCode].filter(Boolean).join(", ") || null}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen(!menuOpen)}
      />

      {/* Mobile Menu */}
      <MobileMenu
        open={menuOpen}
        slug={params.slug}
        onClose={() => setMenuOpen(false)}
        onScrollTo={scrollTo}
        onWriteReview={() => {
          setMenuOpen(false);
          setReviewModalOpen(true);
        }}
      />

      {/* Hero Section */}
      <HeroSection
        heroMediaUrl={shop.heroMediaUrl}
        heroMediaType={shop.heroMediaType}
        name={shop.name}
        description={shop.description}
      />

      {/* Rating Summary */}
      {shop.reviewCount > 0 && (
        <RatingSummary
          averageRating={shop.averageRating}
          reviewCount={shop.reviewCount}
          onScrollToReviews={() => scrollTo("reviews")}
        />
      )}

      <main className="max-w-4xl mx-auto px-4 pb-24">
        {/* Reviews Section */}
        <ReviewsSection
          reviews={shop.reviews}
          reviewCount={shop.reviewCount}
          averageRating={shop.averageRating}
          slug={params.slug}
          onWriteReview={() => setReviewModalOpen(true)}
        />

        {/* Services Section */}
        <ServicesSection services={shop.services} slug={params.slug} />

        {/* Business Hours Section */}
        <BusinessHoursSection businessHours={shop.businessHours} />

        {/* Contact Section */}
        <ContactSection shop={shop} />
      </main>

      {/* Write Review Modal */}
      {reviewModalOpen && (
        <WriteReviewModal
          slug={params.slug}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={(review) => {
            setShop((prev) =>
              prev
                ? {
                    ...prev,
                    reviews: [review, ...prev.reviews],
                    reviewCount: prev.reviewCount + 1,
                    averageRating:
                      (prev.averageRating * prev.reviewCount + review.rating) /
                      (prev.reviewCount + 1),
                  }
                : prev
            );
            setReviewModalOpen(false);
          }}
        />
      )}

      {/* AI Chat Widget */}
      {shop.hasAiChat && (
        <AiChatWidget
          slug={params.slug}
          open={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      )}
    </div>
  );
}

// ─── ShopHeader ─────────────────────────────────────────

function ShopHeader({
  name,
  slug,
  phone,
  address,
  menuOpen,
  onToggleMenu,
  navBar,
}: {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  navBar?: NavBarConfigType;
}) {
  const logoHeight = navBar?.logoHeight ?? 36;
  const showName = navBar?.showName ?? true;
  const hasLogo = navBar?.logoUrl;
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={onToggleMenu} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2 mx-4 min-w-0 flex-1 justify-center">
          {hasLogo && (
            navBar.logoType === "video" ? (
              <video
                src={navBar.logoUrl!}
                autoPlay
                muted
                loop
                playsInline
                className="shrink-0 object-contain"
                style={{ height: logoHeight }}
              />
            ) : (
              <img
                src={navBar.logoUrl!}
                alt={name}
                className="shrink-0 object-contain"
                style={{ height: logoHeight }}
              />
            )
          )}
          {showName && <h1 className="text-lg font-bold truncate">{name}</h1>}
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/shop/${slug}/account`} className="p-2 rounded-lg hover:bg-gray-100">
            <User className="h-5 w-5 text-primary" />
          </Link>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-100">
              <MapPin className="h-5 w-5 text-primary" />
            </a>
          )}
          {phone ? (
            <a href={`tel:${phone}`} className="p-2 -mr-2 rounded-lg hover:bg-gray-100">
              <Phone className="h-5 w-5 text-primary" />
            </a>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </div>
    </header>
  );
}

// ─── MobileMenu ─────────────────────────────────────────

function MobileMenu({
  open,
  slug,
  onClose,
  onScrollTo,
  onWriteReview,
}: {
  open: boolean;
  slug: string;
  onClose: () => void;
  onScrollTo: (id: string) => void;
  onWriteReview: () => void;
}) {
  if (!open) return null;

  const items = [
    { label: "Home", action: () => onScrollTo("hero") },
    { label: "Services", action: () => onScrollTo("services") },
    { label: "Reviews", action: () => onScrollTo("reviews") },
    { label: "Write a Review", action: onWriteReview },
    { label: "Business Hours", action: () => onScrollTo("hours") },
    { label: "Contact", action: () => onScrollTo("contact") },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Slide-out */}
      <nav className="fixed top-[57px] left-0 w-72 h-[calc(100vh-57px)] bg-white z-50 shadow-xl overflow-y-auto animate-in slide-in-from-left duration-200">
        <div className="py-2">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-6 py-3.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-between"
            >
              {item.label}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          <div className="border-t my-2" />
          <Link
            href={`/shop/${slug}/account`}
            onClick={onClose}
            className="block px-6 py-3.5 text-sm font-medium hover:bg-gray-50"
          >
            My Account
          </Link>
          <Link
            href={`/shop/${slug}/book`}
            onClick={onClose}
            className="block px-6 py-3.5 text-sm font-medium text-primary hover:bg-primary/5"
          >
            Book Appointment
          </Link>
        </div>
      </nav>
    </>
  );
}

// ─── HeroSection ────────────────────────────────────────

function HeroSection({
  heroMediaUrl,
  heroMediaType,
  name,
  description,
}: {
  heroMediaUrl: string | null;
  heroMediaType: string | null;
  name: string;
  description: string | null;
}) {
  return (
    <section id="hero" className="relative">
      {heroMediaUrl ? (
        <div className="w-full aspect-video bg-gray-100 relative overflow-hidden">
          {heroMediaType === "video" ? (
            <video
              src={heroMediaUrl}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={heroMediaUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pt-16 pb-5 px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md">{name}</h2>
            {description && (
              <p className="text-sm md:text-base mt-1 text-white/90 drop-shadow-sm line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full bg-gradient-to-br from-primary/10 to-primary/5 py-12 px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold">{name}</h2>
          {description && (
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">{description}</p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── RatingSummary ───────────────────────────────────────

function RatingSummary({
  averageRating,
  reviewCount,
  onScrollToReviews,
}: {
  averageRating: number;
  reviewCount: number;
  onScrollToReviews: () => void;
}) {
  return (
    <button
      onClick={onScrollToReviews}
      className="w-full bg-white border-b px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
    >
      <StarDisplay rating={averageRating} size="sm" />
      <span className="font-semibold text-sm">{averageRating.toFixed(1)}</span>
      <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
    </button>
  );
}

// ─── StarDisplay ────────────────────────────────────────

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ─── ServicesSection ─────────────────────────────────────

function ServicesSection({ services, slug }: { services: Service[]; slug: string }) {
  if (services.length === 0) return null;

  return (
    <section id="services" className="py-8">
      <div className="mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Our Services
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} slug={slug} />
        ))}
      </div>
    </section>
  );
}

// ─── ServiceCard ─────────────────────────────────────────

function ServiceCard({ service, slug }: { service: Service; slug: string }) {
  const hasOptions = service.options && service.options.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedSubOptionIds, setSelectedSubOptionIds] = useState<string[]>([]);

  const selectedOption = hasOptions
    ? service.options.find((o) => o.id === selectedOptionId)
    : null;

  // When selecting/deselecting an option, reset quantity and sub-options
  function handleSelectOption(optionId: string) {
    if (selectedOptionId === optionId) {
      // Deselect
      setSelectedOptionId(null);
      setQuantity(1);
      setSelectedSubOptionIds([]);
    } else {
      const opt = service.options.find((o) => o.id === optionId);
      setSelectedOptionId(optionId);
      setQuantity(opt?.defaultQuantity ?? 1);
      setSelectedSubOptionIds([]);
    }
  }

  function toggleSubOption(subId: string) {
    setSelectedSubOptionIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  }

  // Calculate total price
  const optionPrice = Number(selectedOption?.price ?? 0);
  const subOptionsTotal = selectedOption
    ? selectedOption.subOptions
        .filter((s) => selectedSubOptionIds.includes(s.id))
        .reduce((sum, s) => sum + Number(s.price ?? 0), 0)
    : 0;
  const totalPrice = optionPrice * quantity + subOptionsTotal;

  // Build book URL with quantity and sub-options
  const bookUrl = hasOptions
    ? selectedOptionId
      ? `/shop/${slug}/book?serviceId=${service.id}&optionId=${selectedOptionId}&quantity=${quantity}${
          selectedSubOptionIds.length ? `&subOptions=${selectedSubOptionIds.join(",")}` : ""
        }`
      : "#"
    : `/shop/${slug}/book?serviceId=${service.id}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div
          className={`flex items-start justify-between ${hasOptions ? "cursor-pointer" : ""}`}
          onClick={() => hasOptions && setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-lg truncate">{service.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">{service.duration} min</p>
              {service.price !== null && !hasOptions && (
                <p className="text-xs font-bold text-primary">${service.price}</p>
              )}
              {hasOptions && (
                <span className="text-xs text-muted-foreground">
                  · {service.options.length} options
                </span>
              )}
            </div>
            {service.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
            )}
          </div>
          {hasOptions && (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground flex-shrink-0 ml-2 mt-1 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        {/* Options list (expandable) */}
        {hasOptions && expanded && (
          <div className="mt-3 space-y-1.5 border-t pt-3">
            {service.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              return (
                <div key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectOption(option.id)}
                    className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-gray-50"
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
                      <p className="text-sm font-medium truncate">{option.name}</p>
                      {option.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </p>
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

                  {/* Quantity controls and sub-options for selected option */}
                  {isSelected && (
                    <div className="ml-7 mt-2 space-y-3 pb-2">
                      {/* Quantity controls */}
                      {option.maxQuantity > 1 && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Qty:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity(Math.max(option.minQuantity, quantity - 1));
                              }}
                              className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                              disabled={quantity <= option.minQuantity}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity(Math.min(option.maxQuantity, quantity + 1));
                              }}
                              className="h-7 w-7 rounded border flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                              disabled={quantity >= option.maxQuantity}
                            >
                              <PlusIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Sub-option checkboxes */}
                      {option.subOptions.length > 0 && (
                        <div className="space-y-1.5">
                          {option.subOptions.map((sub) => {
                            const isChecked = selectedSubOptionIds.includes(sub.id);
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSubOption(sub.id);
                                }}
                                className={`w-full text-left flex items-center gap-2.5 p-2 rounded-md transition-colors ${
                                  isChecked ? "bg-primary/5" : "hover:bg-gray-50"
                                }`}
                              >
                                <div
                                  className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                    isChecked
                                      ? "bg-primary border-primary"
                                      : "border-gray-300"
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
                                  <span className="text-xs font-medium text-primary flex-shrink-0">
                                    +${sub.price}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Total price */}
                      {option.price !== null && (
                        <div className="flex items-center justify-between pt-1 border-t">
                          <span className="text-xs font-medium text-muted-foreground">Total</span>
                          <span className="text-sm font-bold text-primary">${totalPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Book button */}
        <div className="mt-3">
          {hasOptions ? (
            selectedOptionId ? (
              <Link href={bookUrl}>
                <Button size="sm" variant="outline" className="w-full text-xs">
                  Book {selectedOption?.name}
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Select an option to book" : "View Options & Book"}
              </Button>
            )
          ) : (
            <Link href={bookUrl}>
              <Button size="sm" variant="outline" className="w-full text-xs">
                Book
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ReviewsSection ─────────────────────────────────────

function ReviewsSection({
  reviews,
  reviewCount,
  averageRating,
  slug,
  onWriteReview,
}: {
  reviews: Review[];
  reviewCount: number;
  averageRating: number;
  slug: string;
  onWriteReview: () => void;
}) {
  const [paused, setPaused] = useState(false);
  // ~292px per card (280 + 12 gap), scroll at ~30px/s
  const duration = reviews.length * 10;

  return (
    <section id="reviews" className="py-8">
      <div className="mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Reviews
        </h3>
        <div className="flex items-center justify-between mt-2">
          <Link href={`/shop/${slug}/reviews`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            {reviewCount > 0 && (
              <>
                <StarDisplay rating={averageRating} size="sm" />
                <span className="font-semibold text-sm">{averageRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </>
            )}
          </Link>
          <Button size="sm" onClick={onWriteReview}>
            Write a Review
          </Button>
        </div>
      </div>
      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          No reviews yet. Be the first to leave a review!
        </p>
      ) : (
        <div
          className="overflow-hidden cursor-pointer"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => {
            setPaused(true);
            (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX);
          }}
          onTouchEnd={(e) => {
            setPaused(false);
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            const endX = e.changedTouches[0].clientX;
            if (Math.abs(endX - startX) < 10) {
              window.location.href = `/shop/${slug}/reviews`;
            }
          }}
        >
          <div
            className="flex gap-3 w-max"
            style={{
              animation: `review-marquee ${duration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {[...reviews, ...reviews].map((review, idx) => (
              <ReviewCard key={`${review.id}-${idx}`} review={review} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── ReviewCard ─────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="flex-shrink-0 w-[280px]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <StarDisplay rating={review.rating} size="sm" />
          <span className="text-xs text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="font-medium text-sm mt-2">{review.customerName}</p>
        {review.comment && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{review.comment}</p>
        )}
        {review.imageUrl && (
          <img
            src={review.imageUrl}
            alt="Review"
            className="mt-2 rounded-lg h-24 w-full object-cover"
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── WriteReviewModal ───────────────────────────────────

function WriteReviewModal({
  slug,
  onClose,
  onSuccess,
}: {
  slug: string;
  onClose: () => void;
  onSuccess: (review: Review) => void;
}) {
  const [step, setStep] = useState<"phone" | "verify" | "review">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/public/shop/${slug}/verify-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("verify");
      } else {
        setError(data.error || "Failed to send verification code");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/public/shop/${slug}/verify-phone`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("review");
      } else {
        setError(data.error || "Invalid or expired code");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/public/shop/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          rating,
          comment: comment || undefined,
          imageUrl: imageUrl || undefined,
          verificationCode: code,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
      } else {
        setError(data.error || "Failed to submit review");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Write a Review</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "phone" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We&apos;ll send a verification code to your phone to verify your identity.
            </p>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={sendOtp} disabled={loading || phone.length < 10} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Verification Code
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to {phone}
            </p>
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl tracking-widest"
              />
            </div>
            <Button onClick={verifyOtp} disabled={code.length !== 6} className="w-full">
              Verify & Continue
            </Button>
            <button
              onClick={() => { setStep("phone"); setCode(""); }}
              className="text-sm text-primary hover:underline w-full text-center"
            >
              Change phone number
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input
                placeholder="John D."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setRating(i)} aria-label={`Rate ${i} out of 5 stars`} className="p-1">
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        i <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200 hover:fill-yellow-200 hover:text-yellow-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea
                placeholder="Tell us about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <ImageIcon className="h-4 w-4" /> Image URL (optional)
              </Label>
              <Input
                placeholder="https://example.com/photo.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <Button onClick={submitReview} disabled={loading || rating === 0} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Review
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BusinessHoursSection ───────────────────────────────

function BusinessHoursSection({ businessHours }: { businessHours: BusinessHour[] }) {
  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const todayIndex = new Date().getDay();
  // JS getDay: 0=Sun, 1=Mon... map to our order
  const todayMap: Record<number, string> = {
    0: "SUNDAY",
    1: "MONDAY",
    2: "TUESDAY",
    3: "WEDNESDAY",
    4: "THURSDAY",
    5: "FRIDAY",
    6: "SATURDAY",
  };
  const today = todayMap[todayIndex];

  return (
    <section id="hours" className="py-8 border-t">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        Business Hours
      </h3>
      <Card>
        <CardContent className="p-4">
          <div className="space-y-1">
            {dayOrder.map((day) => {
              const hours = businessHours.find((h) => h.day === day);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`flex justify-between text-sm py-2 px-2 rounded ${
                    isToday ? "bg-primary/5 font-semibold" : ""
                  }`}
                >
                  <span className="capitalize">
                    {day.toLowerCase()}
                    {isToday && (
                      <span className="text-xs text-primary ml-1">(Today)</span>
                    )}
                  </span>
                  <span className={isToday ? "text-primary" : "text-muted-foreground"}>
                    {hours?.isOpen ? `${hours.openTime} - ${hours.closeTime}` : "Closed"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ─── ContactSection ─────────────────────────────────────

function ContactSection({ shop }: { shop: ShopData }) {
  const fullAddress = [shop.address, shop.city, shop.state].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(
    [shop.address, shop.city, shop.state, shop.zipCode].filter(Boolean).join(", ")
  );
  const whatsappNumber = shop.phone?.replace(/[^0-9]/g, "") || "";
  const hasSocials = shop.facebookUrl || shop.instagramUrl || whatsappNumber;

  return (
    <section id="contact" className="py-8 border-t">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        Contact Us
      </h3>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-3">
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Call Us</p>
                    <p className="text-sm text-muted-foreground">{shop.phone}</p>
                  </div>
                </a>
              )}
              {shop.address && (
                <a
                  href={`https://maps.google.com/?q=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Visit Us</p>
                    <p className="text-sm text-muted-foreground">
                      {fullAddress} {shop.zipCode}
                    </p>
                  </div>
                </a>
              )}
            </div>
            {hasSocials && (
              <div className="flex flex-col items-center gap-3 pl-3 border-l">
                {shop.instagramUrl && (
                  <a href={shop.instagramUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center hover:opacity-80 transition-opacity" title="Instagram">
                    <FaInstagram className="h-5 w-5 text-white" />
                  </a>
                )}
                {shop.facebookUrl && (
                  <a href={shop.facebookUrl} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-80 transition-opacity" title="Facebook">
                    <FaFacebookF className="h-5 w-5 text-white" />
                  </a>
                )}
                {whatsappNumber && (
                  <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center hover:opacity-80 transition-opacity" title="WhatsApp">
                    <FaWhatsapp className="h-5 w-5 text-white" />
                  </a>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CTA buttons */}
      <div className="flex gap-3 mt-6">
        <Link href={`/shop/${shop.slug}/book`} className="flex-1">
          <Button className="w-full" size="lg">
            <Calendar className="mr-2 h-4 w-4" /> Book Appointment
          </Button>
        </Link>
      </div>
    </section>
  );
}

// ─── AiChatWidget ───────────────────────────────────────

function AiChatWidget({
  slug,
  open,
  onToggle,
}: {
  slug: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! How can I help you today? Ask me about our services, hours, booking, or contact info." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/public/shop/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={onToggle}
        aria-label={open ? "Close chat" : "Open chat"}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-gray-700 hover:bg-gray-800"
            : "bg-primary hover:bg-primary/90"
        }`}
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-xl shadow-2xl border flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-4 duration-200">
          {/* Chat header */}
          <div className="px-4 py-3 border-b bg-primary text-white rounded-t-xl">
            <h4 className="font-semibold text-sm">AI Assistant</h4>
            <p className="text-xs opacity-80">Ask me anything about our business</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="text-sm"
              />
              <Button size="icon" onClick={sendMessage} disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Configured Shop Page (Website Builder) ─────────────

function styledTextStyle(tc: TextConfigType, themeFont?: string): React.CSSProperties {
  // Only set fontFamily if it differs from the theme font (let theme cascade via inheritance)
  const fontFamily = tc.fontFamily && tc.fontFamily !== "Inter" && tc.fontFamily !== themeFont
    ? `'${tc.fontFamily}', sans-serif`
    : undefined;

  const style: React.CSSProperties = {
    fontFamily,
    fontSize: tc.fontSize,
    fontWeight: tc.fontWeight,
    color: tc.gradient?.enabled ? "transparent" : tc.color,
    textAlign: tc.alignment,
    letterSpacing: tc.letterSpacing,
    lineHeight: tc.lineHeight,
  };
  if (tc.textShadow?.enabled) {
    style.textShadow = `${tc.textShadow.x}px ${tc.textShadow.y}px ${tc.textShadow.blur}px ${tc.textShadow.color}`;
  }
  if (tc.gradient?.enabled) {
    style.backgroundImage = `linear-gradient(${tc.gradient.direction}, ${tc.gradient.from}, ${tc.gradient.to})`;
    style.WebkitBackgroundClip = "text";
    style.backgroundClip = "text";
  }
  return style;
}

function sanitizeContent(html: string): string {
  if (typeof window === "undefined") return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["span", "strong", "em", "u", "br", "p", "mark"],
    ALLOWED_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
}

// Filter CSS properties inside style attributes to only allow safe ones
if (typeof window !== "undefined") {
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && data.attrValue) {
      const allowed = data.attrValue
        .split(";")
        .map((s) => s.trim())
        .filter((s) => {
          const prop = s.split(":")[0]?.trim().toLowerCase();
          return prop === "color" || prop === "background-color";
        })
        .join("; ");
      data.attrValue = allowed;
    }
  });
}

function isContentEmpty(content: string): boolean {
  const stripped = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return stripped.length === 0;
}

function StyledText({ config, themeFont }: { config: TextConfigType; themeFont?: string }) {
  if (!config.content || isContentEmpty(config.content)) return null;
  const hasHTML = /<[a-z][\s\S]*>/i.test(config.content);
  if (hasHTML) {
    return (
      <div
        style={styledTextStyle(config, themeFont)}
        dangerouslySetInnerHTML={{ __html: sanitizeContent(config.content) }}
      />
    );
  }
  return <div style={styledTextStyle(config, themeFont)}>{config.content}</div>;
}

function collectFontsFromText(fonts: Set<string>, tc: TextConfigType | undefined) {
  if (tc?.fontFamily) fonts.add(tc.fontFamily);
}

function useGoogleFonts(config: WebsiteConfigType) {
  useEffect(() => {
    const fonts = new Set<string>();
    fonts.add(config.theme.fontFamily);
    for (const section of config.sections) {
      if ("headline" in section) collectFontsFromText(fonts, (section as HeroSectionType).headline);
      if ("subtitle" in section) collectFontsFromText(fonts, (section as HeroSectionType).subtitle);
      if ("title" in section) collectFontsFromText(fonts, (section as ReviewsSectionType).title);
      if ("body" in section) collectFontsFromText(fonts, (section as AboutSectionType).body);
      if ("caption" in section) collectFontsFromText(fonts, (section as MediaBlockSectionType).caption);
      if (section.type === "custom") {
        for (const el of section.elements) {
          if (el.type === "text") {
            collectFontsFromText(fonts, el.title);
            collectFontsFromText(fonts, el.body);
          } else if (el.type === "media") {
            collectFontsFromText(fonts, el.caption);
          } else if (el.type === "text-over-media") {
            collectFontsFromText(fonts, el.headline);
            collectFontsFromText(fonts, el.subtitle);
          }
        }
      }
    }
    // Remove "Inter" — already loaded by Next.js font optimization
    fonts.delete("Inter");
    if (fonts.size === 0) return;

    const families = Array.from(fonts)
      .map((f) => f.replace(/ /g, "+") + ":wght@300;400;500;600;700")
      .join("&family=");
    const id = "google-fonts-custom";

    // Add preconnect links if not already present
    if (!document.querySelector('link[href="https://fonts.googleapis.com"]')) {
      const preconnect1 = document.createElement("link");
      preconnect1.rel = "preconnect";
      preconnect1.href = "https://fonts.googleapis.com";
      document.head.appendChild(preconnect1);

      const preconnect2 = document.createElement("link");
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      document.head.appendChild(preconnect2);
    }

    // Remove old font link if it exists
    const old = document.getElementById(id);
    if (old) old.remove();

    // Insert font stylesheet into <head>
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);

    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [config]);
}

function ConfiguredHero({ section, theme, slug }: { section: HeroSectionType; theme: WebsiteConfigType["theme"]; slug: string }) {
  return (
    <section id="hero" className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: `${section.minHeight}vh` }}>
      {section.mediaUrl ? (
        section.mediaType === "video" ? (
          <video src={section.mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={section.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: section.overlay.color, opacity: section.overlay.opacity }} />
      <div className="relative z-10 text-center px-6 py-12 max-w-4xl mx-auto">
        <StyledText config={section.headline} />
        {section.subtitle.content && <div className="mt-4"><StyledText config={section.subtitle} /></div>}
        {section.cta.enabled && (
          <div className="mt-6">
            <Link href={section.cta.url || `/shop/${slug}/book`}>
              <Button size="lg" style={{ backgroundColor: theme.primaryColor }} className="text-white hover:opacity-90">
                {section.cta.text || "Book Now"}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ConfiguredReviews({ section, reviews, reviewCount, averageRating, slug, onWriteReview }: { section: ReviewsSectionType; reviews: Review[]; reviewCount: number; averageRating: number; slug: string; onWriteReview: () => void }) {
  const [paused, setPaused] = useState(false);
  const duration = reviews.length * 10;

  return (
    <section id="reviews" className="py-8">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/shop/${slug}/reviews`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          {reviewCount > 0 && (
            <>
              <StarDisplay rating={averageRating} size="sm" />
              <span className="font-semibold text-sm">{averageRating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </Link>
        <Button variant="outline" size="sm" onClick={onWriteReview}>
          <Star className="h-4 w-4 mr-1" /> Write a Review
        </Button>
      </div>
      {reviews.length > 0 ? (
        <div
          className="overflow-hidden cursor-pointer"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => {
            setPaused(true);
            (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX);
          }}
          onTouchEnd={(e) => {
            setPaused(false);
            const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0);
            const endX = e.changedTouches[0].clientX;
            if (Math.abs(endX - startX) < 10) {
              window.location.href = `/shop/${slug}/reviews`;
            }
          }}
        >
          <div
            className="flex gap-3 w-max"
            style={{
              animation: `review-marquee ${duration}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
            }}
          >
            {[...reviews, ...reviews].map((review, idx) => (
              <ReviewCard key={`${review.id}-${idx}`} review={review} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center mt-4">No reviews yet.</p>
      )}
    </section>
  );
}

function ConfiguredServices({ section, services, slug }: { section: ServicesSectionType; services: Service[]; slug: string }) {
  if (services.length === 0) return null;
  return (
    <section id="services" className="py-8">
      <div className="mb-4">
        <StyledText config={section.title} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} slug={slug} />
        ))}
      </div>
    </section>
  );
}

function ConfiguredAbout({ section }: { section: AboutSectionType }) {
  return (
    <section id="about" className="py-8">
      <StyledText config={section.title} />
      {section.body.content && <div className="mt-4"><StyledText config={section.body} /></div>}
    </section>
  );
}

function ConfiguredTextBlock({ section }: { section: TextBlockSectionType }) {
  return (
    <section style={{ backgroundColor: section.backgroundColor, padding: section.padding }}>
      <div className="max-w-4xl mx-auto">
        <StyledText config={section.title} />
        {section.body.content && <div className="mt-3"><StyledText config={section.body} /></div>}
      </div>
    </section>
  );
}

function ConfiguredMediaBlock({ section }: { section: MediaBlockSectionType }) {
  const aspectStyle = section.aspectRatio === "auto" ? undefined : section.aspectRatio.replace("/", " / ");
  return (
    <section className="py-8">
      <div className="max-w-4xl mx-auto px-4">
        {section.mediaUrl ? (
          section.mediaType === "video" ? (
            <video src={section.mediaUrl} controls muted className="w-full rounded-lg" style={{ aspectRatio: aspectStyle, objectFit: "cover" }} />
          ) : (
            <img src={section.mediaUrl} alt="" className="w-full rounded-lg" style={{ aspectRatio: aspectStyle, objectFit: "cover" }} />
          )
        ) : (
          <div className="bg-gray-200 rounded-lg flex items-center justify-center aspect-video max-h-[200px] sm:max-h-none">
            <ImageIcon className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
          </div>
        )}
        {section.caption.content && <div className="mt-2"><StyledText config={section.caption} /></div>}
      </div>
    </section>
  );
}

function ConfiguredTextOverMedia({ section, theme, slug }: { section: TextOverMediaSectionType; theme: WebsiteConfigType["theme"]; slug: string }) {
  return (
    <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: `${section.minHeight}vh` }}>
      {section.mediaUrl ? (
        section.mediaType === "video" ? (
          <video src={section.mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={section.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: section.overlay.color, opacity: section.overlay.opacity }} />
      <div className="relative z-10 text-center px-6 py-12 max-w-4xl mx-auto">
        <StyledText config={section.headline} />
        {section.subtitle.content && <div className="mt-4"><StyledText config={section.subtitle} /></div>}
        {section.cta.enabled && (
          <div className="mt-6">
            <Link href={section.cta.url || `/shop/${slug}/book`}>
              <Button size="lg" style={{ backgroundColor: theme.primaryColor }} className="text-white hover:opacity-90">
                {section.cta.text || "Learn More"}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ConfiguredMediaElement({ element }: { element: MediaElementType }) {
  const aspectStyle = element.aspectRatio === "auto" ? undefined : element.aspectRatio.replace("/", " / ");
  return (
    <div>
      {element.mediaUrl ? (
        element.mediaType === "video" ? (
          <video src={element.mediaUrl} controls muted className="w-full rounded-lg" style={{ aspectRatio: aspectStyle, objectFit: "cover" }} />
        ) : (
          <img src={element.mediaUrl} alt="" className="w-full rounded-lg" style={{ aspectRatio: aspectStyle, objectFit: "cover" }} />
        )
      ) : (
        <div className="bg-gray-200 rounded-lg flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
          <ImageIcon className="h-12 w-12 text-gray-400" />
        </div>
      )}
      {element.caption.content && <div className="mt-2"><StyledText config={element.caption} /></div>}
    </div>
  );
}

function ConfiguredTextOverMediaElement({ element, theme, slug }: { element: TextOverMediaElementType; theme: WebsiteConfigType["theme"]; slug: string }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg" style={{ minHeight: `${element.minHeight}vh` }}>
      {element.mediaUrl ? (
        element.mediaType === "video" ? (
          <video src={element.mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <img src={element.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-600 to-gray-800" />
      )}
      <div className="absolute inset-0" style={{ backgroundColor: element.overlay.color, opacity: element.overlay.opacity }} />
      <div className="relative z-10 text-center px-6 py-12 max-w-4xl mx-auto">
        <StyledText config={element.headline} />
        {element.subtitle.content && <div className="mt-4"><StyledText config={element.subtitle} /></div>}
        {element.cta.enabled && (
          <div className="mt-6">
            <Link href={element.cta.url || `/shop/${slug}/book`}>
              <Button size="lg" style={{ backgroundColor: theme.primaryColor }} className="text-white hover:opacity-90">
                {element.cta.text || "Learn More"}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfiguredCustomSection({ section, theme, slug }: { section: CustomSectionType; theme: WebsiteConfigType["theme"]; slug: string }) {
  return (
    <section style={{ backgroundColor: section.backgroundColor, padding: section.padding }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {section.elements.map((element) => {
          switch (element.type) {
            case "text":
              return (
                <div key={element.id}>
                  {element.title.content && <StyledText config={element.title} />}
                  {element.body.content && <div className="mt-3"><StyledText config={element.body} /></div>}
                </div>
              );
            case "media":
              return <ConfiguredMediaElement key={element.id} element={element} />;
            case "text-over-media":
              return <ConfiguredTextOverMediaElement key={element.id} element={element} theme={theme} slug={slug} />;
            default:
              return null;
          }
        })}
      </div>
    </section>
  );
}

function ConfiguredShopPage({
  shop,
  config,
  slug,
  reviewModalOpen,
  setReviewModalOpen,
  chatOpen,
  setChatOpen,
}: {
  shop: ShopData;
  config: WebsiteConfigType;
  slug: string;
  reviewModalOpen: boolean;
  setReviewModalOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [localShop, setLocalShop] = useState(shop);
  useGoogleFonts(config);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: config.theme.backgroundColor, fontFamily: `'${config.theme.fontFamily}', sans-serif` }}>
      {/* Google Fonts loaded via useGoogleFonts hook into <head> */}

      <ShopHeader
        name={localShop.name}
        slug={slug}
        phone={localShop.phone}
        address={[localShop.address, localShop.city, localShop.state, localShop.zipCode].filter(Boolean).join(", ") || null}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen(!menuOpen)}
        navBar={config.navBar}
      />

      <MobileMenu
        open={menuOpen}
        slug={slug}
        onClose={() => setMenuOpen(false)}
        onScrollTo={scrollTo}
        onWriteReview={() => { setMenuOpen(false); setReviewModalOpen(true); }}
      />

      {/* Render sections in order */}
      {config.sections.map((section) => {
        if (!section.visible) return null;

        switch (section.type) {
          case "hero":
            return <ConfiguredHero key={section.id} section={section} theme={config.theme} slug={slug} />;
          case "reviews":
            return (
              <div key={section.id} className="max-w-4xl mx-auto px-4">
                <ConfiguredReviews section={section} reviews={localShop.reviews} reviewCount={localShop.reviewCount} averageRating={localShop.averageRating} slug={slug} onWriteReview={() => setReviewModalOpen(true)} />
              </div>
            );
          case "services":
            return (
              <div key={section.id} className="max-w-4xl mx-auto px-4">
                <ConfiguredServices section={section} services={localShop.services} slug={slug} />
              </div>
            );
          case "about":
            return (
              <div key={section.id} className="max-w-4xl mx-auto px-4">
                <ConfiguredAbout section={section} />
              </div>
            );
          case "text-block":
            return <ConfiguredTextBlock key={section.id} section={section} />;
          case "media-block":
            return <ConfiguredMediaBlock key={section.id} section={section} />;
          case "text-over-media":
            return <ConfiguredTextOverMedia key={section.id} section={section} theme={config.theme} slug={slug} />;
          case "custom":
            return <ConfiguredCustomSection key={section.id} section={section} theme={config.theme} slug={slug} />;
          default:
            return null;
        }
      })}

      {/* Business Hours + Contact (always appended) */}
      <main className="max-w-4xl mx-auto px-4 pb-24">
        <BusinessHoursSection businessHours={localShop.businessHours} />
        <ContactSection shop={localShop} />
      </main>

      {reviewModalOpen && (
        <WriteReviewModal
          slug={slug}
          onClose={() => setReviewModalOpen(false)}
          onSuccess={(review) => {
            setLocalShop((prev) => ({
              ...prev,
              reviews: [review, ...prev.reviews],
              reviewCount: prev.reviewCount + 1,
              averageRating: (prev.averageRating * prev.reviewCount + review.rating) / (prev.reviewCount + 1),
            }));
            setReviewModalOpen(false);
          }}
        />
      )}

      {localShop.hasAiChat && (
        <AiChatWidget
          slug={slug}
          open={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      )}
    </div>
  );
}
