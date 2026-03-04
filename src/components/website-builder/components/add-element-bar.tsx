"use client";

import { Button } from "@/components/ui/button";
import { Type, Film, Layers } from "lucide-react";
import type { SectionElement } from "@/types";
import {
  createDefaultTextElement,
  createDefaultMediaElement,
  createDefaultTextOverMediaElement,
} from "../constants";

interface AddElementBarProps {
  onAdd: (element: SectionElement) => void;
  elementCount: number;
}

export function AddElementBar({ onAdd, elementCount }: AddElementBarProps) {
  if (elementCount >= 20) {
    return <p className="text-xs text-muted-foreground text-center py-1">Maximum 20 elements</p>;
  }

  return (
    <div className="flex items-center gap-2 pt-2 border-t">
      <span className="text-xs text-muted-foreground">Add:</span>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAdd(createDefaultTextElement())}>
        <Type className="h-3 w-3 mr-1" /> Text
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAdd(createDefaultMediaElement())}>
        <Film className="h-3 w-3 mr-1" /> Media
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAdd(createDefaultTextOverMediaElement())}>
        <Layers className="h-3 w-3 mr-1" /> Text+Media
      </Button>
    </div>
  );
}
