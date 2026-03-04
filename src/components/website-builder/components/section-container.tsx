"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Image, Star, Wrench, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WebsiteSectionConfig, SectionElement } from "@/types";
import { SECTION_TYPE_LABELS } from "../constants";
import { HeroEditor } from "../section-editors/hero-editor";
import { ReviewsEditor } from "../section-editors/reviews-editor";
import { ServicesEditor } from "../section-editors/services-editor";
import { ColorPicker } from "../editors/color-picker";
import { ElementList } from "./element-list";
import { AddElementBar } from "./add-element-bar";

const SECTION_ICONS: Record<string, React.ElementType> = {
  hero: Image,
  reviews: Star,
  services: Wrench,
  custom: LayoutGrid,
};

interface SectionContainerProps {
  section: WebsiteSectionConfig;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<WebsiteSectionConfig>) => void;
  onAddElement?: (element: SectionElement) => void;
  onRemoveElement?: (elementId: string) => void;
  onUpdateElement?: (elementId: string, updates: Partial<SectionElement>) => void;
  onReorderElements?: (elementIds: string[]) => void;
  isPinned?: boolean;
}

export function SectionContainer({
  section,
  expanded,
  onToggleExpand,
  onToggleVisibility,
  onDelete,
  onUpdate,
  onAddElement,
  onRemoveElement,
  onUpdateElement,
  onReorderElements,
  isPinned,
}: SectionContainerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: isPinned,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = SECTION_ICONS[section.type] || LayoutGrid;
  const isBuiltIn = ["hero", "reviews", "services"].includes(section.type);
  const displayName = section.type === "custom" ? section.name : (SECTION_TYPE_LABELS[section.type] || section.type);

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border ${!section.visible ? "opacity-50" : ""}`}>
      {/* Header bar */}
      <div
        className={`flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
          expanded ? "border-b bg-muted/30" : ""
        }`}
        onClick={onToggleExpand}
      >
        <button
          {...attributes}
          {...listeners}
          className={`p-0.5 rounded hover:bg-muted ${isPinned ? "opacity-30 cursor-not-allowed" : "cursor-grab"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />

        <span className="text-sm font-medium flex-1 truncate">{displayName}</span>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onToggleVisibility} className="p-1 rounded hover:bg-muted" title={section.visible ? "Hide" : "Show"}>
            {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {!isBuiltIn && (
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-500" title="Delete section">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </div>

      {/* Collapsible body */}
      {expanded && (
        <div className="p-3 space-y-4">
          {/* Built-in section editors */}
          {section.type === "hero" && (
            <HeroEditor section={section} onChange={onUpdate} />
          )}
          {section.type === "reviews" && (
            <ReviewsEditor section={section} onChange={onUpdate} />
          )}
          {section.type === "services" && (
            <ServicesEditor section={section} onChange={onUpdate} />
          )}

          {/* Custom section: section-level controls + elements */}
          {section.type === "custom" && (
            <>
              {/* Section-level controls */}
              <div className="space-y-3 pb-3 border-b">
                <div className="space-y-1">
                  <Label className="text-xs">Section Name</Label>
                  <Input
                    value={section.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="Section name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorPicker
                    label="Background"
                    value={section.backgroundColor}
                    onChange={(backgroundColor) => onUpdate({ backgroundColor })}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">Padding (px)</Label>
                    <Input
                      type="number"
                      value={section.padding}
                      onChange={(e) => onUpdate({ padding: Number(e.target.value) })}
                      min={0}
                      max={200}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Elements */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elements</h4>
                {onUpdateElement && onRemoveElement && onReorderElements && (
                  <ElementList
                    elements={section.elements}
                    onUpdate={onUpdateElement}
                    onDelete={onRemoveElement}
                    onReorder={onReorderElements}
                  />
                )}
                {onAddElement && (
                  <AddElementBar onAdd={onAddElement} elementCount={section.elements.length} />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
