"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2, Type, Film, Layers } from "lucide-react";
import type { SectionElement } from "@/types";
import { TextElementEditor } from "../editors/text-element-editor";
import { MediaElementEditor } from "../editors/media-element-editor";
import { TextOverMediaElementEditor } from "../editors/text-over-media-element-editor";

const ELEMENT_ICONS: Record<string, React.ElementType> = {
  text: Type,
  media: Film,
  "text-over-media": Layers,
};

const ELEMENT_LABELS: Record<string, string> = {
  text: "Text",
  media: "Media",
  "text-over-media": "Text + Media",
};

function getPreviewText(element: SectionElement): string {
  switch (element.type) {
    case "text":
      return element.title.content || element.body.content || "Empty text";
    case "media":
      return element.caption.content || (element.mediaUrl ? "Media uploaded" : "No media");
    case "text-over-media":
      return element.headline.content || "Text over media";
  }
}

interface ElementItemProps {
  element: SectionElement;
  onUpdate: (updates: Partial<SectionElement>) => void;
  onDelete: () => void;
}

export function ElementItem({ element, onUpdate, onDelete }: ElementItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = ELEMENT_ICONS[element.type] || Type;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 rounded hover:bg-muted cursor-grab"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground">{ELEMENT_LABELS[element.type]}</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{getPreviewText(element)}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete element">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 border-t pt-3">
          {element.type === "text" && (
            <TextElementEditor element={element} onChange={onUpdate} />
          )}
          {element.type === "media" && (
            <MediaElementEditor element={element} onChange={onUpdate} />
          )}
          {element.type === "text-over-media" && (
            <TextOverMediaElementEditor element={element} onChange={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}
