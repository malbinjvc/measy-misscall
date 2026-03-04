"use client";

import type { ReviewsSectionConfig } from "@/types";
import { TextConfigEditor } from "../editors/text-config-editor";

interface ReviewsEditorProps {
  section: ReviewsSectionConfig;
  onChange: (updates: Partial<ReviewsSectionConfig>) => void;
}

export function ReviewsEditor({ section, onChange }: ReviewsEditorProps) {
  return (
    <div className="space-y-4">
      <TextConfigEditor label="Section Title" value={section.title} onChange={(title) => onChange({ title })} />
      <p className="text-xs text-muted-foreground">Reviews content is pulled automatically from verified customer reviews.</p>
    </div>
  );
}
