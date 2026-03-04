import { useReducer, useCallback } from "react";
import type {
  WebsiteConfig,
  WebsiteSectionConfig,
  WebsiteTheme,
  NavBarConfig,
  CustomSectionConfig,
  SectionElement,
} from "@/types";

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
  | { type: "REORDER_ELEMENTS"; sectionId: string; elementIds: string[] };

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

function reducer(state: WebsiteConfig, action: Action): WebsiteConfig {
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

    default:
      return state;
  }
}

export function useWebsiteConfig(initial: WebsiteConfig) {
  const [config, dispatch] = useReducer(reducer, initial);

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
    addElement,
    removeElement,
    updateElement,
    reorderElements,
  };
}
