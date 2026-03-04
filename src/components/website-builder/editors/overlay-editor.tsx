"use client";

import type { OverlayConfig } from "@/types";
import { ColorPicker } from "./color-picker";

interface OverlayEditorProps {
  value: OverlayConfig;
  onChange: (value: OverlayConfig) => void;
}

export function OverlayEditor({ value, onChange }: OverlayEditorProps) {
  return (
    <ColorPicker
      label="Overlay"
      value={value.color}
      onChange={(color) => onChange({ ...value, color })}
      showOpacity
      opacity={value.opacity}
      onOpacityChange={(opacity) => onChange({ ...value, opacity })}
    />
  );
}
