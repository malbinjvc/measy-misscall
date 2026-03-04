import type {
  WebsiteConfig,
  WebsiteSectionConfig,
  CustomSectionConfig,
  SectionElement,
  TextConfig,
  CtaConfig,
  OverlayConfig,
} from "@/types";

interface LegacyAboutSection {
  type: "about";
  id: string;
  visible: boolean;
  title: TextConfig;
  body: TextConfig;
}

interface LegacyTextBlockSection {
  type: "text-block";
  id: string;
  visible: boolean;
  title: TextConfig;
  body: TextConfig;
  backgroundColor: string;
  padding: number;
}

interface LegacyMediaBlockSection {
  type: "media-block";
  id: string;
  visible: boolean;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  caption: TextConfig;
  aspectRatio: "16/9" | "4/3" | "1/1" | "auto";
}

interface LegacyTextOverMediaSection {
  type: "text-over-media";
  id: string;
  visible: boolean;
  mediaUrl: string | null;
  mediaType: "image" | "video";
  headline: TextConfig;
  subtitle: TextConfig;
  cta: CtaConfig;
  overlay: OverlayConfig;
  minHeight: number;
}

type LegacySection =
  | LegacyAboutSection
  | LegacyTextBlockSection
  | LegacyMediaBlockSection
  | LegacyTextOverMediaSection;

function isLegacySection(section: { type: string }): section is LegacySection {
  return ["about", "text-block", "media-block", "text-over-media"].includes(section.type);
}

function migrateSection(section: LegacySection): CustomSectionConfig {
  const elements: SectionElement[] = [];

  switch (section.type) {
    case "about":
      elements.push({
        type: "text",
        id: `${section.id}-text`,
        title: section.title,
        body: section.body,
      });
      return {
        type: "custom",
        id: section.id,
        visible: section.visible,
        name: section.title.content || "About",
        backgroundColor: "#ffffff",
        padding: 48,
        elements,
      };

    case "text-block":
      elements.push({
        type: "text",
        id: `${section.id}-text`,
        title: section.title,
        body: section.body,
      });
      return {
        type: "custom",
        id: section.id,
        visible: section.visible,
        name: section.title.content || "Text Section",
        backgroundColor: section.backgroundColor,
        padding: section.padding,
        elements,
      };

    case "media-block":
      elements.push({
        type: "media",
        id: `${section.id}-media`,
        mediaUrl: section.mediaUrl,
        mediaType: section.mediaType,
        caption: section.caption,
        aspectRatio: section.aspectRatio,
      });
      return {
        type: "custom",
        id: section.id,
        visible: section.visible,
        name: "Media",
        backgroundColor: "#ffffff",
        padding: 32,
        elements,
      };

    case "text-over-media":
      elements.push({
        type: "text-over-media",
        id: `${section.id}-tom`,
        mediaUrl: section.mediaUrl,
        mediaType: section.mediaType,
        headline: section.headline,
        subtitle: section.subtitle,
        cta: section.cta,
        overlay: section.overlay,
        minHeight: section.minHeight,
      });
      return {
        type: "custom",
        id: section.id,
        visible: section.visible,
        name: section.headline.content || "Text Over Media",
        backgroundColor: "#ffffff",
        padding: 0,
        elements,
      };
  }
}

/**
 * Migrates a WebsiteConfig from legacy section types (about, text-block,
 * media-block, text-over-media) into custom sections with elements.
 * Hero, reviews, and services sections are passed through unchanged.
 * This is a pure function — no side effects.
 */
export function migrateConfig(config: WebsiteConfig): WebsiteConfig {
  const hasLegacy = config.sections.some((s) => isLegacySection(s as { type: string }));
  if (!hasLegacy) return config;

  const sections: WebsiteSectionConfig[] = config.sections.map((section) => {
    if (isLegacySection(section as { type: string })) {
      return migrateSection(section as unknown as LegacySection);
    }
    return section as WebsiteSectionConfig;
  });

  return { ...config, sections };
}
