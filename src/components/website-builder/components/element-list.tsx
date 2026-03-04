"use client";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SectionElement } from "@/types";
import { ElementItem } from "./element-item";

interface ElementListProps {
  elements: SectionElement[];
  onUpdate: (elementId: string, updates: Partial<SectionElement>) => void;
  onDelete: (elementId: string) => void;
  onReorder: (elementIds: string[]) => void;
}

export function ElementList({ elements, onUpdate, onDelete, onReorder }: ElementListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = elements.map((e) => e.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    const newIds = [...ids];
    newIds.splice(oldIndex, 1);
    newIds.splice(newIndex, 0, String(active.id));
    onReorder(newIds);
  };

  if (elements.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-2">No elements yet. Add one below.</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={elements.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {elements.map((element) => (
            <ElementItem
              key={element.id}
              element={element}
              onUpdate={(updates) => onUpdate(element.id, updates)}
              onDelete={() => onDelete(element.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
