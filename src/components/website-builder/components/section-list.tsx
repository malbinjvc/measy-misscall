"use client";

import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { WebsiteSectionConfig, SectionElement } from "@/types";
import { SectionContainer } from "./section-container";

interface SectionListProps {
  sections: WebsiteSectionConfig[];
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (sectionIds: string[]) => void;
  onUpdate: (id: string, updates: Partial<WebsiteSectionConfig>) => void;
  onAddElement: (sectionId: string, element: SectionElement) => void;
  onRemoveElement: (sectionId: string, elementId: string) => void;
  onUpdateElement: (sectionId: string, elementId: string, updates: Partial<SectionElement>) => void;
  onReorderElements: (sectionId: string, elementIds: string[]) => void;
  onDuplicate?: (id: string) => void;
}

export function SectionList({
  sections,
  onToggleVisibility,
  onDelete,
  onReorder,
  onUpdate,
  onAddElement,
  onRemoveElement,
  onUpdateElement,
  onReorderElements,
  onDuplicate,
}: SectionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    // Prevent moving anything above hero (index 0)
    if (newIndex === 0 && sections[0]?.type === "hero") return;
    if (oldIndex === 0 && sections[0]?.type === "hero") return;

    const newIds = [...ids];
    newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, String(active.id));
    onReorder(newIds);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <SectionContainer
              key={section.id}
              section={section}
              expanded={expandedId === section.id}
              onToggleExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
              onToggleVisibility={() => onToggleVisibility(section.id)}
              onDelete={() => onDelete(section.id)}
              onUpdate={(updates) => onUpdate(section.id, updates)}
              onAddElement={(element) => onAddElement(section.id, element)}
              onRemoveElement={(elementId) => onRemoveElement(section.id, elementId)}
              onUpdateElement={(elementId, updates) => onUpdateElement(section.id, elementId, updates)}
              onReorderElements={(elementIds) => onReorderElements(section.id, elementIds)}
              onDuplicate={onDuplicate ? () => onDuplicate(section.id) : undefined}
              isPinned={index === 0 && section.type === "hero"}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
