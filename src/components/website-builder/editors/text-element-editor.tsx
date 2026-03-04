"use client";

import type { TextElement } from "@/types";
import { TextConfigEditor } from "./text-config-editor";

interface TextElementEditorProps {
  element: TextElement;
  onChange: (updates: Partial<TextElement>) => void;
}

export function TextElementEditor({ element, onChange }: TextElementEditorProps) {
  return (
    <div className="space-y-3">
      <TextConfigEditor label="Title" value={element.title} onChange={(title) => onChange({ title })} />
      <TextConfigEditor label="Body" value={element.body} onChange={(body) => onChange({ body })} multiline />
    </div>
  );
}
