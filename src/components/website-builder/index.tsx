"use client";

import { useState } from "react";
import type { TenantData, WebsiteConfig } from "@/types";
import type { UseMutationResult } from "@tanstack/react-query";
import { useWebsiteConfig } from "./hooks/use-website-config";
import { createDefaultConfig, DEFAULT_NAVBAR } from "./constants";
import { migrateConfig } from "./migrate";
import { Toolbar } from "./components/toolbar";
import { SectionList } from "./components/section-list";
import { AddSectionDialog } from "./components/add-section-dialog";
import { ThemeEditor } from "./components/theme-editor";
import { NavBarEditor } from "./components/navbar-editor";
import { ChevronDown, ChevronRight } from "lucide-react";

interface WebsiteBuilderProps {
  tenant: TenantData;
  mutation: UseMutationResult<unknown, Error, Record<string, unknown>>;
}

export function WebsiteBuilder({ tenant, mutation }: WebsiteBuilderProps) {
  const rawConfig = (tenant.websiteConfig as WebsiteConfig | null) ??
    createDefaultConfig(tenant.name, tenant.description, tenant.heroMediaUrl, tenant.heroMediaType, tenant.slug);

  // Migrate legacy sections on load
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
    addElement,
    removeElement,
    updateElement,
    reorderElements,
  } = useWebsiteConfig(initialConfig);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [navBarOpen, setNavBarOpen] = useState(false);

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

  return (
    <div className="mt-4">
      <Toolbar onSave={handleSave} saving={mutation.isPending} />

      {saveSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Website configuration saved successfully.
        </div>
      )}

      {mutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutation.error?.message || "Failed to save"}
        </div>
      )}

      {/* Single-column layout */}
      <div className="space-y-4">
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

        {/* Section List (accordion) */}
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
        />

        {/* Add Section */}
        <AddSectionDialog onAdd={addSection} sectionCount={config.sections.length} />
      </div>
    </div>
  );
}
