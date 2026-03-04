"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { WebsiteSectionConfig } from "@/types";
import { createDefaultCustomSection } from "../constants";

interface AddSectionDialogProps {
  onAdd: (section: WebsiteSectionConfig) => void;
  sectionCount: number;
}

export function AddSectionDialog({ onAdd, sectionCount }: AddSectionDialogProps) {
  if (sectionCount >= 20) {
    return <p className="text-xs text-muted-foreground text-center py-2">Maximum 20 sections reached</p>;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => onAdd(createDefaultCustomSection())}
    >
      <Plus className="h-4 w-4 mr-1" /> Add Section
    </Button>
  );
}
