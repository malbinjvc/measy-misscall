"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TenantData, WebsiteConfig } from "@/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useWebsiteConfig } from "./hooks/use-website-config";
import { createDefaultConfig, DEFAULT_NAVBAR } from "./constants";
import { migrateConfig } from "./migrate";
import { Toolbar, type PreviewWidth } from "./components/toolbar";
import { SectionList } from "./components/section-list";
import { AddSectionDialog } from "./components/add-section-dialog";
import { ThemeEditor } from "./components/theme-editor";
import { NavBarEditor } from "./components/navbar-editor";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebsiteBuilderProps {
  tenant: TenantData;
  mutation: UseMutationResult<unknown, Error, Record<string, unknown>>;
}

function formatSaveError(error: Error): string {
  const msg = error.message || "Failed to save";
  try {
    if (msg.includes("{")) {
      const parsed = JSON.parse(msg);
      if (parsed.issues && Array.isArray(parsed.issues)) {
        return parsed.issues
          .map((issue: { path?: string[]; message?: string }) => {
            const path = issue.path?.join(" > ") || "Unknown field";
            return `${path}: ${issue.message}`;
          })
          .join(". ");
      }
    }
  } catch {
    // Not JSON, use as-is
  }
  return msg;
}

export function WebsiteBuilder({ tenant, mutation }: WebsiteBuilderProps) {
  const rawConfig = (tenant.websiteConfig as WebsiteConfig | null) ??
    createDefaultConfig(tenant.name, tenant.description, tenant.heroMediaUrl, tenant.heroMediaType, tenant.slug);

  const initialConfig = migrateConfig(rawConfig);

  const {
    config,
    updateTheme,
    updateNavBar,
    updateSection,
    addSection,
    removeSection,
    toggleSection,
    reorderSections,
    duplicateSection,
    addElement,
    removeElement,
    updateElement,
    reorderElements,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWebsiteConfig(initialConfig);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [navBarOpen, setNavBarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("100%");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = `/shop/${tenant.slug}`;

  const refreshPreview = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  // Send live config to preview iframe on every change
  useEffect(() => {
    if (!previewOpen || !iframeRef.current) return;
    const iframe = iframeRef.current;
    try {
      iframe.contentWindow?.postMessage(
        { type: "website-builder-config", config },
        window.location.origin
      );
    } catch {
      // iframe not ready yet
    }
  }, [config, previewOpen]);

  const handleSave = () => {
    setSaveSuccess(false);
    mutation.mutate(
      { section: "website", config },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      }
    );
  };

  const iframeMaxWidth = previewWidth === "100%" ? "100%" : previewWidth;

  return (
    <div className="mt-4">
      <Toolbar
        onSave={handleSave}
        saving={mutation.isPending}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen(!previewOpen)}
        previewWidth={previewWidth}
        onPreviewWidthChange={setPreviewWidth}
      />

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Website configuration saved successfully.
        </div>
      )}

      {mutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formatSaveError(mutation.error)}
        </div>
      )}

      <div className={`flex gap-4 ${previewOpen ? "" : ""}`}>
        {/* Editor panel */}
        <div className={`space-y-4 ${previewOpen ? "w-1/2 min-w-0 shrink-0" : "w-full"}`}>
          {/* Collapsible Nav Bar Editor */}
          <div className="rounded-lg border">
            <button
              className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 transition-colors"
              onClick={() => setNavBarOpen(!navBarOpen)}
            >
              {navBarOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-semibold">Navigation Bar</span>
            </button>
            {navBarOpen && (
              <div className="px-3 pb-3">
                <NavBarEditor
                  navBar={config.navBar ?? DEFAULT_NAVBAR}
                  onChange={updateNavBar}
                />
              </div>
            )}
          </div>

          {/* Collapsible Theme Editor */}
          <div className="rounded-lg border">
            <button
              className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 transition-colors"
              onClick={() => setThemeOpen(!themeOpen)}
            >
              {themeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-semibold">Global Theme</span>
            </button>
            {themeOpen && (
              <div className="px-3 pb-3">
                <ThemeEditor theme={config.theme} onChange={updateTheme} />
              </div>
            )}
          </div>

          {/* Section List */}
          <SectionList
            sections={config.sections}
            onToggleVisibility={toggleSection}
            onDelete={removeSection}
            onReorder={reorderSections}
            onUpdate={updateSection}
            onAddElement={addElement}
            onRemoveElement={removeElement}
            onUpdateElement={updateElement}
            onReorderElements={reorderElements}
            onDuplicate={duplicateSection}
          />

          {/* Add Section */}
          <AddSectionDialog onAdd={addSection} sectionCount={config.sections.length} />
        </div>

        {/* Preview panel (side panel with iframe) */}
        {previewOpen && (
          <div className="w-1/2 min-w-0 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                Live Preview
                {previewWidth !== "100%" && ` (${previewWidth})`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={refreshPreview}
                title="Refresh preview"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 rounded-lg border bg-muted/30 overflow-hidden flex justify-center">
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="h-[calc(100vh-12rem)] border-0 bg-white transition-all duration-300"
                style={{ width: iframeMaxWidth, maxWidth: "100%" }}
                title="Website preview"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
