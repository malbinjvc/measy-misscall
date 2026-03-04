"use client";

import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface ToolbarProps {
  onSave: () => void;
  saving: boolean;
}

export function Toolbar({ onSave, saving }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b pb-3 mb-4">
      <h2 className="text-lg font-semibold">Website Builder</h2>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
        Save
      </Button>
    </div>
  );
}
