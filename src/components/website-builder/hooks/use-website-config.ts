import { useReducer, useCallback } from "react";
import type {
  WebsiteConfig,
  WebsiteSectionConfig,
  WebsiteTheme,
  NavBarConfig,
  CustomSectionConfig,
  SectionElement,
} from "@/types";

const MAX_HISTORY = 20;

type Action =
  | { type: "SET_CONFIG"; config: WebsiteConfig }
  | { type: "UPDATE_THEME"; theme: Partial<WebsiteTheme> }
  | { type: "UPDATE_NAVBAR"; navBar: Partial<NavBarConfig> }
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<WebsiteSectionConfig> }
  | { type: "ADD_SECTION"; section: WebsiteSectionConfig }
  | { type: "REMOVE_SECTION"; id: string }
  | { type: "TOGGLE_SECTION"; id: string }
  | { type: "REORDER_SECTIONS"; sectionIds: string[] }
  | { type: "ADD_ELEMENT"; sectionId: string; element: SectionElement }
  | { type: "REMOVE_ELEMENT"; sectionId: string; elementId: string }
  | { type: "UPDATE_ELEMENT"; sectionId: string; elementId: string; updates: Partial<SectionElement> }
  | { type: "REORDER_ELEMENTS"; sectionId: string; elementIds: string[] }
  | { type: "DUPLICATE_SECTION"; id: string }
  | { type: "UNDO" }
  | { type: "REDO" };

interface HistoryState {
  config: WebsiteConfig;
  past: WebsiteConfig[];
  future: WebsiteConfig[];
}

function updateCustomSection(
  state: WebsiteConfig,
  sectionId: string,
  updater: (section: CustomSectionConfig) => CustomSectionConfig
): WebsiteConfig {
  return {
    ...state,
    sections: state.sections.map((s) => {
      if (s.id === sectionId && s.type === "custom") {
        return updater(s);
      }
      return s;
    }),
  };
}

function applyConfigAction(state: WebsiteConfig, action: Action): WebsiteConfig {
  switch (action.type) {
    case "SET_CONFIG":
      return action.config;

    case "UPDATE_THEME":
      return { ...state, theme: { ...state.theme, ...action.theme } };

    case "UPDATE_NAVBAR":
      return { ...state, navBar: { ...(state.navBar ?? { logoUrl: null, logoType: "image", logoHeight: 36, showName: true }), ...action.navBar } };

    case "UPDATE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? ({ ...s, ...action.updates } as WebsiteSectionConfig) : s
        ),
      };

    case "ADD_SECTION":
      return { ...state, sections: [...state.sections, action.section] };

    case "REMOVE_SECTION":
      return { ...state, sections: state.sections.filter((s) => s.id !== action.id) };

    case "TOGGLE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? ({ ...s, visible: !s.visible } as WebsiteSectionConfig) : s
        ),
      };

    case "REORDER_SECTIONS": {
      const map = new Map(state.sections.map((s) => [s.id, s]));
      const reordered = action.sectionIds.map((id) => map.get(id)!).filter(Boolean);
      return { ...state, sections: reordered };
    }

    case "ADD_ELEMENT":
      return updateCustomSection(state, action.sectionId, (s) => ({
        ...s,
        elements: [...s.elements, action.element],
      }));

    case "REMOVE_ELEMENT":
      return updateCustomSection(state, action.sectionId, (s) => ({
        ...s,
        elements: s.elements.filter((e) => e.id !== action.elementId),
      }));

    case "UPDATE_ELEMENT":
      return updateCustomSection(state, action.sectionId, (s) => ({
        ...s,
        elements: s.elements.map((e) =>
          e.id === action.elementId ? ({ ...e, ...action.updates } as SectionElement) : e
        ),
      }));

    case "REORDER_ELEMENTS":
      return updateCustomSection(state, action.sectionId, (s) => {
        const map = new Map(s.elements.map((e) => [e.id, e]));
        const reordered = action.elementIds.map((id) => map.get(id)!).filter(Boolean);
        return { ...s, elements: reordered };
      });

    case "DUPLICATE_SECTION": {
      const idx = state.sections.findIndex((s) => s.id === action.id);
      if (idx === -1) return state;
      const original = state.sections[idx];
      if (original.type !== "custom") return state;
      const cloned: CustomSectionConfig = {
        ...JSON.parse(JSON.stringify(original)),
        id: `custom-${Date.now()}`,
        name: `${original.name} (Copy)`,
      };
      const newSections = [...state.sections];
      newSections.splice(idx + 1, 0, cloned);
      return { ...state, sections: newSections };
    }

    default:
      return state;
  }
}

function historyReducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      config: previous,
      past: state.past.slice(0, -1),
      future: [state.config, ...state.future],
    };
  }

  if (action.type === "REDO") {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      config: next,
      past: [...state.past, state.config],
      future: state.future.slice(1),
    };
  }

  // All other actions: apply to config and push to history
  const newConfig = applyConfigAction(state.config, action);
  if (newConfig === state.config) return state;

  return {
    config: newConfig,
    past: [...state.past, state.config].slice(-MAX_HISTORY),
    future: [],
  };
}

export function useWebsiteConfig(initial: WebsiteConfig) {
  const [state, dispatch] = useReducer(historyReducer, {
    config: initial,
    past: [],
    future: [],
  });

  const { config } = state;
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const setConfig = useCallback((c: WebsiteConfig) => dispatch({ type: "SET_CONFIG", config: c }), []);
  const updateTheme = useCallback((theme: Partial<WebsiteTheme>) => dispatch({ type: "UPDATE_THEME", theme }), []);
  const updateNavBar = useCallback((navBar: Partial<NavBarConfig>) => dispatch({ type: "UPDATE_NAVBAR", navBar }), []);
  const updateSection = useCallback(
    (id: string, updates: Partial<WebsiteSectionConfig>) => dispatch({ type: "UPDATE_SECTION", id, updates }),
    []
  );
  const addSection = useCallback((section: WebsiteSectionConfig) => dispatch({ type: "ADD_SECTION", section }), []);
  const removeSection = useCallback((id: string) => dispatch({ type: "REMOVE_SECTION", id }), []);
  const toggleSection = useCallback((id: string) => dispatch({ type: "TOGGLE_SECTION", id }), []);
  const reorderSections = useCallback(
    (sectionIds: string[]) => dispatch({ type: "REORDER_SECTIONS", sectionIds }),
    []
  );
  const duplicateSection = useCallback((id: string) => dispatch({ type: "DUPLICATE_SECTION", id }), []);

  // Element CRUD
  const addElement = useCallback(
    (sectionId: string, element: SectionElement) => dispatch({ type: "ADD_ELEMENT", sectionId, element }),
    []
  );
  const removeElement = useCallback(
    (sectionId: string, elementId: string) => dispatch({ type: "REMOVE_ELEMENT", sectionId, elementId }),
    []
  );
  const updateElement = useCallback(
    (sectionId: string, elementId: string, updates: Partial<SectionElement>) =>
      dispatch({ type: "UPDATE_ELEMENT", sectionId, elementId, updates }),
    []
  );
  const reorderElements = useCallback(
    (sectionId: string, elementIds: string[]) => dispatch({ type: "REORDER_ELEMENTS", sectionId, elementIds }),
    []
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return {
    config,
    setConfig,
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
  };
}
