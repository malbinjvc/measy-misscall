"use client";

import type { HeroSectionConfig } from "@/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TextConfigEditor } from "../editors/text-config-editor";
import { MediaUploader } from "../editors/media-uploader";
import { OverlayEditor } from "../editors/overlay-editor";
import { CtaEditor } from "../editors/cta-editor";

interface HeroEditorProps {
  section: HeroSectionConfig;
  onChange: (updates: Partial<HeroSectionConfig>) => void;
}

export function HeroEditor({ section, onChange }: HeroEditorProps) {
  return (
    <div className="space-y-4">
      <MediaUploader
        label="Hero Media"
        mediaUrl={section.mediaUrl}
        mediaType={section.mediaType}
        onMediaChange={(url, type) => onChange({ mediaUrl: url, mediaType: type })}
      />
      <TextConfigEditor label="Headline" value={section.headline} onChange={(headline) => onChange({ headline })} />
      <TextConfigEditor label="Subtitle" value={section.subtitle} onChange={(subtitle) => onChange({ subtitle })} multiline />
      <CtaEditor value={section.cta} onChange={(cta) => onChange({ cta })} />
      <OverlayEditor value={section.overlay} onChange={(overlay) => onChange({ overlay })} />
      <div className="space-y-1">
        <Label className="text-xs">Min Height (vh)</Label>
        <Input
          type="number"
          value={section.minHeight}
          onChange={(e) => onChange({ minHeight: Number(e.target.value) })}
          min={20}
          max={100}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
