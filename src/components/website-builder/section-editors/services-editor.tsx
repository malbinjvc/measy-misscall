"use client";

import type { ServicesSectionConfig } from "@/types";
import { TextConfigEditor } from "../editors/text-config-editor";

interface ServicesEditorProps {
  section: ServicesSectionConfig;
  onChange: (updates: Partial<ServicesSectionConfig>) => void;
}

export function ServicesEditor({ section, onChange }: ServicesEditorProps) {
  return (
    <div className="space-y-4">
      <TextConfigEditor label="Section Title" value={section.title} onChange={(title) => onChange({ title })} />
      <p className="text-xs text-muted-foreground">Services are managed from the Services settings page.</p>
    </div>
  );
}
