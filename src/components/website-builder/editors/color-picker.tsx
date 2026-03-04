"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COLOR_PRESETS } from "../constants";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showOpacity?: boolean;
  opacity?: number;
  onOpacityChange?: (value: number) => void;
}

export function ColorPicker({ label, value, onChange, showOpacity, opacity, onOpacityChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 text-xs font-mono"
          placeholder="#000000"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-110 transition-transform"
            style={{ backgroundColor: preset }}
            title={preset}
          />
        ))}
      </div>
      {showOpacity && onOpacityChange && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs">Opacity</Label>
            <span className="text-xs text-muted-foreground">{Math.round((opacity ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity ?? 1}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-full h-2"
          />
        </div>
      )}
    </div>
  );
}
