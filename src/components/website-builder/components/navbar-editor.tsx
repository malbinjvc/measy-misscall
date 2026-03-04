"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NavBarConfig } from "@/types";
import { MediaUploader } from "../editors/media-uploader";

interface NavBarEditorProps {
  navBar: NavBarConfig;
  onChange: (updates: Partial<NavBarConfig>) => void;
}

export function NavBarEditor({ navBar, onChange }: NavBarEditorProps) {
  return (
    <div className="space-y-4">
      <MediaUploader
        label="Logo / GIF / Video"
        mediaUrl={navBar.logoUrl}
        mediaType={navBar.logoType === "gif" ? "image" : navBar.logoType}
        onMediaChange={(url, type) => {
          // Detect gif from URL
          const isGif = url?.toLowerCase().endsWith(".gif");
          onChange({
            logoUrl: url,
            logoType: isGif ? "gif" : type,
          });
        }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Logo Type</Label>
          <select
            value={navBar.logoType}
            onChange={(e) => onChange({ logoType: e.target.value as NavBarConfig["logoType"] })}
            className="w-full h-8 rounded-md border px-2 text-xs bg-background"
          >
            <option value="image">Image</option>
            <option value="gif">GIF</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Logo Height (px)</Label>
          <Input
            type="number"
            value={navBar.logoHeight}
            onChange={(e) => onChange({ logoHeight: Number(e.target.value) })}
            min={16}
            max={120}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={navBar.showName}
          onCheckedChange={(showName) => onChange({ showName })}
        />
        <Label className="text-xs">Show business name next to logo</Label>
      </div>
    </div>
  );
}
