"use client";

import type { WebsiteTheme } from "@/types";
import { Label } from "@/components/ui/label";
import { GOOGLE_FONTS } from "@/types";
import { ColorPicker } from "../editors/color-picker";

interface ThemeEditorProps {
  theme: WebsiteTheme;
  onChange: (updates: Partial<WebsiteTheme>) => void;
}

export function ThemeEditor({ theme, onChange }: ThemeEditorProps) {
  return (
    <div className="space-y-4">
      <ColorPicker label="Primary Color" value={theme.primaryColor} onChange={(primaryColor) => onChange({ primaryColor })} />
      <ColorPicker label="Secondary Color" value={theme.secondaryColor} onChange={(secondaryColor) => onChange({ secondaryColor })} />
      <ColorPicker label="Background" value={theme.backgroundColor} onChange={(backgroundColor) => onChange({ backgroundColor })} />
      <div className="space-y-1">
        <Label className="text-xs">Font Family</Label>
        <select
          value={theme.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="w-full h-8 rounded-md border px-2 text-xs bg-background"
        >
          {GOOGLE_FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
