"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, Film } from "lucide-react";
import type { WebsiteSectionConfig } from "@/types";
import { createDefaultCustomSection, createDefaultReelSection } from "../constants";

interface AddSectionDialogProps {
  onAdd: (section: WebsiteSectionConfig) => void;
  sectionCount: number;
}

export function AddSectionDialog({ onAdd, sectionCount }: AddSectionDialogProps) {
  const [open, setOpen] = useState(false);

  if (sectionCount >= 20) {
    return <p className="text-xs text-muted-foreground text-center py-2">Maximum 20 sections reached</p>;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-4 w-4 mr-1" /> Add Section
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 z-20 rounded-lg border bg-card shadow-lg p-2 space-y-1">
            <button
              className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-left hover:bg-muted transition-colors"
              onClick={() => {
                onAdd(createDefaultCustomSection());
                setOpen(false);
              }}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">General Section</p>
                <p className="text-xs text-muted-foreground">Add text, media, or banners</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-left hover:bg-muted transition-colors"
              onClick={() => {
                onAdd(createDefaultReelSection());
                setOpen(false);
              }}
            >
              <Film className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Reel Section</p>
                <p className="text-xs text-muted-foreground">Carousel cards with fullscreen viewer</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
