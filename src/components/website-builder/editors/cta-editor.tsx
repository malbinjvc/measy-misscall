"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CtaConfig } from "@/types";

interface CtaEditorProps {
  value: CtaConfig;
  onChange: (value: CtaConfig) => void;
}

export function CtaEditor({ value, onChange }: CtaEditorProps) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
        <Label className="text-sm font-semibold">Call to Action</Label>
      </div>
      {value.enabled && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Button Text</Label>
            <Input value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} className="h-8 text-xs" placeholder="/shop/slug/book" />
          </div>
        </div>
      )}
    </div>
  );
}
