"use client";

import { Button } from "@/components/ui/button";
import { Save, Loader2, Undo2, Redo2, Monitor, Tablet, Smartphone, PanelRightOpen, PanelRightClose } from "lucide-react";

export type PreviewWidth = "100%" | "768px" | "375px";

interface ToolbarProps {
  onSave: () => void;
  saving: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  previewOpen?: boolean;
  onTogglePreview?: () => void;
  previewWidth?: PreviewWidth;
  onPreviewWidthChange?: (width: PreviewWidth) => void;
}

export function Toolbar({
  onSave,
  saving,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  previewOpen,
  onTogglePreview,
  previewWidth = "100%",
  onPreviewWidthChange,
}: ToolbarProps) {
  const widths: { value: PreviewWidth; icon: typeof Monitor; label: string }[] = [
    { value: "100%", icon: Monitor, label: "Desktop" },
    { value: "768px", icon: Tablet, label: "Tablet" },
    { value: "375px", icon: Smartphone, label: "Mobile" },
  ];

  return (
    <div className="flex items-center justify-between border-b pb-3 mb-4 gap-2 flex-wrap">
      {/* Left: Undo/Redo */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Responsive preview toggle (only show when preview is open) */}
      {previewOpen && (
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {widths.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => onPreviewWidthChange?.(value)}
              className={`p-1.5 rounded transition-colors ${
                previewWidth === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}

      {/* Right: Preview toggle + Save */}
      <div className="flex items-center gap-2">
        {onTogglePreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePreview}
            title={previewOpen ? "Close preview" : "Open preview"}
          >
            {previewOpen ? (
              <PanelRightClose className="h-4 w-4 mr-1" />
            ) : (
              <PanelRightOpen className="h-4 w-4 mr-1" />
            )}
            Preview
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  );
}
