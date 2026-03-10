"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GOOGLE_FONTS, type TextConfig, type TextShadowConfig, type TextGradientConfig } from "@/types";
import { ColorPicker } from "./color-picker";
import { RichTextEditor } from "./rich-text-editor";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

interface TextConfigEditorProps {
  label: string;
  value: TextConfig;
  onChange: (value: TextConfig) => void;
  multiline?: boolean;
}

export function TextConfigEditor({ label, value, onChange, multiline }: TextConfigEditorProps) {
  const update = (updates: Partial<TextConfig>) => onChange({ ...value, ...updates });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <Label className="text-sm font-semibold">{label}</Label>

      {/* Content */}
      <div className="space-y-1">
        <Label className="text-xs">Content</Label>
        <RichTextEditor
          content={value.content}
          onChange={(html) => update({ content: html })}
          multiline={multiline}
        />
      </div>

      {/* Font Family + Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Font</Label>
          <select
            value={value.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="w-full h-8 rounded-md border px-2 text-xs bg-background"
          >
            {GOOGLE_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Size (px)</Label>
          <Input
            type="number"
            value={value.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            min={8}
            max={200}
            className="h-8 text-xs"
            title="Text size in pixels (8-200)"
          />
        </div>
      </div>

      {/* Weight + Color */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Weight</Label>
          <select
            value={value.fontWeight}
            onChange={(e) => update({ fontWeight: Number(e.target.value) })}
            className="w-full h-8 rounded-md border px-2 text-xs bg-background"
            title="Text thickness (100=thin, 700=bold, 900=black)"
          >
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <ColorPicker label="Color" value={value.color} onChange={(color) => update({ color })} />
      </div>

      {/* Alignment */}
      <div className="space-y-1">
        <Label className="text-xs">Alignment</Label>
        <div className="flex gap-1">
          {([
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const).map(([align, Icon]) => (
            <button
              key={align}
              onClick={() => update({ alignment: align })}
              className={`p-1.5 rounded border ${value.alignment === align ? "bg-primary text-white" : "bg-background hover:bg-muted"}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Letter Spacing + Line Height */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Letter Spacing</Label>
          <Input
            type="number"
            value={value.letterSpacing}
            onChange={(e) => update({ letterSpacing: Number(e.target.value) })}
            step={0.5}
            className="h-8 text-xs"
            title="Space between letters in pixels"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Line Height</Label>
          <Input
            type="number"
            value={value.lineHeight}
            onChange={(e) => update({ lineHeight: Number(e.target.value) })}
            step={0.1}
            min={0.5}
            max={4}
            className="h-8 text-xs"
            title="Space between lines (1=tight, 2=double-spaced)"
          />
        </div>
      </div>

      {/* Text Shadow */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={value.textShadow?.enabled ?? false}
            onCheckedChange={(enabled) => {
              const shadow: TextShadowConfig = value.textShadow ?? { enabled: false, x: 1, y: 1, blur: 3, color: "#000000" };
              update({ textShadow: { ...shadow, enabled } });
            }}
          />
          <Label className="text-xs" title="Add a shadow behind the text">Text Shadow</Label>
        </div>
        {value.textShadow?.enabled && (
          <div className="grid grid-cols-3 gap-2 pl-4">
            <div className="space-y-1">
              <Label className="text-xs">X</Label>
              <Input type="number" value={value.textShadow.x} onChange={(e) => update({ textShadow: { ...value.textShadow!, x: Number(e.target.value) } })} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Y</Label>
              <Input type="number" value={value.textShadow.y} onChange={(e) => update({ textShadow: { ...value.textShadow!, y: Number(e.target.value) } })} className="h-7 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Blur</Label>
              <Input type="number" value={value.textShadow.blur} onChange={(e) => update({ textShadow: { ...value.textShadow!, blur: Number(e.target.value) } })} min={0} className="h-7 text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* Gradient Text */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={value.gradient?.enabled ?? false}
            onCheckedChange={(enabled) => {
              const gradient: TextGradientConfig = value.gradient ?? { enabled: false, from: "#2563eb", to: "#7c3aed", direction: "to right" };
              update({ gradient: { ...gradient, enabled } });
            }}
          />
          <Label className="text-xs" title="Apply a gradient color effect to the text">Gradient Text</Label>
        </div>
        {value.gradient?.enabled && (
          <div className="grid grid-cols-2 gap-2 pl-4">
            <ColorPicker label="From" value={value.gradient.from} onChange={(from) => update({ gradient: { ...value.gradient!, from } })} />
            <ColorPicker label="To" value={value.gradient.to} onChange={(to) => update({ gradient: { ...value.gradient!, to } })} />
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Direction</Label>
              <select
                value={value.gradient.direction}
                onChange={(e) => update({ gradient: { ...value.gradient!, direction: e.target.value } })}
                className="w-full h-8 rounded-md border px-2 text-xs bg-background"
              >
                <option value="to right">Left to Right</option>
                <option value="to left">Right to Left</option>
                <option value="to bottom">Top to Bottom</option>
                <option value="to top">Bottom to Top</option>
                <option value="to bottom right">Diagonal</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
