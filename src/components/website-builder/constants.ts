import type {
  WebsiteConfig,
  WebsiteTheme,
  NavBarConfig,
  HeroSectionConfig,
  ReviewsSectionConfig,
  ServicesSectionConfig,
  CustomSectionConfig,
  TextElement,
  MediaElement,
  TextOverMediaElement,
  TextConfig,
  CtaConfig,
  OverlayConfig,
} from "@/types";

export const DEFAULT_TEXT: TextConfig = {
  content: "",
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  color: "#000000",
  alignment: "left",
  letterSpacing: 0,
  lineHeight: 1.5,
};

export const DEFAULT_CTA: CtaConfig = {
  enabled: false,
  text: "Book Now",
  url: "",
};

export const DEFAULT_OVERLAY: OverlayConfig = {
  color: "#000000",
  opacity: 0.4,
};

export const DEFAULT_THEME: WebsiteTheme = {
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  fontFamily: "Inter",
  backgroundColor: "#ffffff",
};

export const DEFAULT_NAVBAR: NavBarConfig = {
  logoUrl: null,
  logoType: "image",
  logoHeight: 36,
  showName: true,
};

export const COLOR_PRESETS = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0d9488",
  "#0284c7", "#4f46e5", "#000000", "#ffffff",
];

export function createDefaultHero(
  name: string,
  description: string | null,
  mediaUrl: string | null,
  mediaType: string | null,
  slug: string
): HeroSectionConfig {
  return {
    type: "hero",
    id: "hero",
    visible: true,
    mediaUrl: mediaUrl || null,
    mediaType: (mediaType as "image" | "video") || "image",
    headline: { ...DEFAULT_TEXT, content: name, fontSize: 48, fontWeight: 700, color: "#ffffff", alignment: "center" },
    subtitle: { ...DEFAULT_TEXT, content: description || "", fontSize: 20, fontWeight: 400, color: "#ffffff", alignment: "center" },
    cta: { enabled: true, text: "Book Now", url: `/shop/${slug}/book` },
    overlay: { ...DEFAULT_OVERLAY },
    minHeight: 60,
  };
}

export function createDefaultReviews(): ReviewsSectionConfig {
  return {
    type: "reviews",
    id: "reviews",
    visible: true,
    title: { ...DEFAULT_TEXT, content: "What Our Customers Say", fontSize: 28, fontWeight: 700, alignment: "center" },
  };
}

export function createDefaultServices(): ServicesSectionConfig {
  return {
    type: "services",
    id: "services",
    visible: true,
    title: { ...DEFAULT_TEXT, content: "Our Services", fontSize: 28, fontWeight: 700, alignment: "center" },
  };
}

// ─── Element Factories ──────────────────────────────

export function createDefaultTextElement(): TextElement {
  return {
    type: "text",
    id: `text-${Date.now()}`,
    title: { ...DEFAULT_TEXT, content: "Heading", fontSize: 24, fontWeight: 700, alignment: "center" },
    body: { ...DEFAULT_TEXT, content: "Add your content here...", fontSize: 16, alignment: "center" },
  };
}

export function createDefaultMediaElement(): MediaElement {
  return {
    type: "media",
    id: `media-${Date.now()}`,
    mediaUrl: null,
    mediaType: "image",
    caption: { ...DEFAULT_TEXT, content: "", fontSize: 14, alignment: "center", color: "#6b7280" },
    aspectRatio: "16/9",
  };
}

export function createDefaultTextOverMediaElement(): TextOverMediaElement {
  return {
    type: "text-over-media",
    id: `tom-${Date.now()}`,
    mediaUrl: null,
    mediaType: "image",
    headline: { ...DEFAULT_TEXT, content: "Your Headline", fontSize: 36, fontWeight: 700, color: "#ffffff", alignment: "center" },
    subtitle: { ...DEFAULT_TEXT, content: "", fontSize: 18, color: "#ffffff", alignment: "center" },
    cta: { ...DEFAULT_CTA },
    overlay: { ...DEFAULT_OVERLAY },
    minHeight: 50,
  };
}

// ─── Custom Section Factory ─────────────────────────

export function createDefaultCustomSection(): CustomSectionConfig {
  return {
    type: "custom",
    id: `custom-${Date.now()}`,
    visible: true,
    name: "New Section",
    backgroundColor: "#ffffff",
    padding: 32,
    elements: [],
  };
}

// ─── Default Config ─────────────────────────────────

export function createDefaultConfig(
  name: string,
  description: string | null,
  heroMediaUrl: string | null,
  heroMediaType: string | null,
  slug: string
): WebsiteConfig {
  return {
    theme: { ...DEFAULT_THEME },
    navBar: { ...DEFAULT_NAVBAR },
    sections: [
      createDefaultHero(name, description, heroMediaUrl, heroMediaType, slug),
      createDefaultReviews(),
      createDefaultServices(),
      {
        type: "custom",
        id: "about",
        visible: true,
        name: "About",
        backgroundColor: "#ffffff",
        padding: 48,
        elements: [
          {
            type: "text",
            id: "about-title",
            title: { ...DEFAULT_TEXT, content: `About ${name}`, fontSize: 28, fontWeight: 700, alignment: "center" },
            body: { ...DEFAULT_TEXT, content: description || "", fontSize: 16, fontWeight: 400, alignment: "center" },
          },
        ],
      },
    ],
  };
}

export const SECTION_TYPE_LABELS: Record<string, string> = {
  hero: "Hero",
  reviews: "Reviews",
  services: "Services",
  custom: "Custom Section",
};
