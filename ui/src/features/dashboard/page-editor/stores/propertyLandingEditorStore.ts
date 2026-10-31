import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import {
  defaultPropertyLandingSectionConfig,
  PROPERTY_LANDING_MANDATORY_SECTIONS,
  PROPERTY_LANDING_SECTION_ORDER,
} from '@/features/guest/marketing/properties/lib/propertyLandingSections';
import type {
  PropertyLandingSectionConfig,
  PropertyLandingSectionId,
} from '@/features/guest/marketing/properties/types/publicProperty';

const HISTORY_LIMIT = 50;

type PropertyLandingEditorState = {
  config: PropertyLandingSectionConfig;
  history: PropertyLandingSectionConfig[];
  historyIndex: number;
  isDirty: boolean;
  hydrated: boolean;
};

type PropertyLandingEditorActions = {
  hydrate: (config: PropertyLandingSectionConfig) => void;
  reset: () => void;
  setSectionVisible: (id: PropertyLandingSectionId, visible: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markClean: () => void;
};

function cloneConfig(config: PropertyLandingSectionConfig): PropertyLandingSectionConfig {
  return JSON.parse(JSON.stringify(config)) as PropertyLandingSectionConfig;
}

/** Force product-fixed section order; mandatory sections always visible. */
function normalizeLandingConfig(
  config: PropertyLandingSectionConfig
): PropertyLandingSectionConfig {
  const byId = new Map(config.sections.map((section) => [section.id, section]));
  return {
    version: 1,
    sections: PROPERTY_LANDING_SECTION_ORDER.map((id, order) => {
      const existing = byId.get(id);
      return {
        id,
        order,
        visible: PROPERTY_LANDING_MANDATORY_SECTIONS.has(id) ? true : (existing?.visible ?? true),
      };
    }),
  };
}

function pushHistory(state: PropertyLandingEditorState) {
  const next = state.history.slice(0, state.historyIndex + 1);
  next.push(cloneConfig(state.config));
  if (next.length > HISTORY_LIMIT) next.shift();
  state.history = next;
  state.historyIndex = next.length - 1;
}

export const usePropertyLandingEditorStore = create<
  PropertyLandingEditorState & PropertyLandingEditorActions
>()(
  immer((set, get) => ({
    config: defaultPropertyLandingSectionConfig(),
    history: [defaultPropertyLandingSectionConfig()],
    historyIndex: 0,
    isDirty: false,
    hydrated: false,

    hydrate: (config) =>
      set((state) => {
        const next = normalizeLandingConfig(config);
        state.config = next;
        state.history = [cloneConfig(next)];
        state.historyIndex = 0;
        state.isDirty = false;
        state.hydrated = true;
      }),

    reset: () =>
      set((state) => {
        const next = defaultPropertyLandingSectionConfig();
        state.config = next;
        state.history = [cloneConfig(next)];
        state.historyIndex = 0;
        state.isDirty = false;
        state.hydrated = false;
      }),

    setSectionVisible: (id, visible) =>
      set((state) => {
        if (PROPERTY_LANDING_MANDATORY_SECTIONS.has(id)) return;
        const section = state.config.sections.find(
          (entry: PropertyLandingSectionConfig['sections'][number]) => entry.id === id
        );
        if (!section) return;
        section.visible = visible;
        state.isDirty = true;
        pushHistory(state);
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        const previous = state.history[state.historyIndex];
        if (previous) {
          state.config = normalizeLandingConfig(previous);
          state.isDirty = true;
        }
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        const next = state.history[state.historyIndex];
        if (next) {
          state.config = normalizeLandingConfig(next);
          state.isDirty = true;
        }
      }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),
  }))
);
