"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TextOverMediaElement } from "@/types";
import { MediaUploader } from "./media-uploader";
import { TextConfigEditor } from "./text-config-editor";
import { OverlayEditor } from "./overlay-editor";
import { CtaEditor } from "./cta-editor";

interface TextOverMediaElementEditorProps {
  element: TextOverMediaElement;
  onChange: (updates: Partial<TextOverMediaElement>) => void;
}

export function TextOverMediaElementEditor({ element, onChange }: TextOverMediaElementEditorProps) {
  return (
    <div className="space-y-3">
      <MediaUploader
        label="Background Media"
        mediaUrl={element.mediaUrl}
        mediaType={element.mediaType}
        onMediaChange={(url, type) => onChange({ mediaUrl: url, mediaType: type })}
      />
      <TextConfigEditor label="Headline" value={element.headline} onChange={(headline) => onChange({ headline })} />
      <TextConfigEditor label="Subtitle" value={element.subtitle} onChange={(subtitle) => onChange({ subtitle })} multiline />
      <CtaEditor value={element.cta} onChange={(cta) => onChange({ cta })} />
      <OverlayEditor value={element.overlay} onChange={(overlay) => onChange({ overlay })} />
      <div className="space-y-1">
        <Label className="text-xs">Min Height (vh)</Label>
        <Input
          type="number"
          value={element.minHeight}
          onChange={(e) => onChange({ minHeight: Number(e.target.value) })}
          min={20}
          max={100}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
