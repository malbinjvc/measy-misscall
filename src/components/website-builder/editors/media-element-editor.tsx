"use client";

import { Label } from "@/components/ui/label";
import type { MediaElement } from "@/types";
import { MediaUploader } from "./media-uploader";
import { TextConfigEditor } from "./text-config-editor";

interface MediaElementEditorProps {
  element: MediaElement;
  onChange: (updates: Partial<MediaElement>) => void;
}

export function MediaElementEditor({ element, onChange }: MediaElementEditorProps) {
  return (
    <div className="space-y-3">
      <MediaUploader
        label="Media"
        mediaUrl={element.mediaUrl}
        mediaType={element.mediaType}
        onMediaChange={(url, type) => onChange({ mediaUrl: url, mediaType: type })}
      />
      <div className="space-y-1">
        <Label className="text-xs">Aspect Ratio</Label>
        <select
          value={element.aspectRatio}
          onChange={(e) => onChange({ aspectRatio: e.target.value as MediaElement["aspectRatio"] })}
          className="w-full h-8 rounded-md border px-2 text-xs bg-background"
        >
          <option value="16/9">16:9</option>
          <option value="4/3">4:3</option>
          <option value="1/1">1:1</option>
          <option value="auto">Auto</option>
        </select>
      </div>
      <TextConfigEditor label="Caption" value={element.caption} onChange={(caption) => onChange({ caption })} />
    </div>
  );
}
