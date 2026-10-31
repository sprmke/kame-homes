import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import {
  defaultPropertyShowcaseConfig,
  normalizeShowcasePaletteMode,
  SHOWCASE_PRESET_PALETTE_IDS,
  SHOWCASE_SECTION_IDS,
  type PropertyShowcaseConfig,
  type PropertyShowcaseSectionConfig,
  type ShowcasePaletteMode,
  type ShowcaseSectionId,
  type ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';

const HISTORY_LIMIT = 50;

const REQUIRED_VISIBLE = new Set<ShowcaseSectionId>(['hero', 'cta']);

type Snapshot = {
  config: PropertyShowcaseConfig;
  templateKey: ShowcaseTemplateKey;
};

type PropertyShowcaseEditorState = {
  config: PropertyShowcaseConfig;
  templateKey: ShowcaseTemplateKey;
  history: Snapshot[];
  historyIndex: number;
  isDirty: boolean;
  hydrated: boolean;
};

type PropertyShowcaseEditorActions = {
  hydrate: (config: PropertyShowcaseConfig, templateKey: ShowcaseTemplateKey) => void;
  reset: () => void;
  setTemplateKey: (templateKey: ShowcaseTemplateKey) => void;
  setSectionVisible: (id: ShowcaseSectionId, visible: boolean) => void;
  reorderSections: (orderedIds: ShowcaseSectionId[]) => void;
  setSectionCopy: (
    id: ShowcaseSectionId,
    copy: { heading?: string; subheading?: string; body?: string }
  ) => void;
  setSectionColumns: (id: ShowcaseSectionId, columns: number) => void;
  setSectionImageSlots: (id: ShowcaseSectionId, imageSlots: string[]) => void;
  setSectionCta: (id: ShowcaseSectionId, ctaLabel?: string, ctaTarget?: string) => void;
  setSectionHeroEyebrow: (
    id: ShowcaseSectionId,
    heroEyebrow: PropertyShowcaseConfig['sections'][number]['heroEyebrow']
  ) => void;
  setSectionLocationLead: (
    id: ShowcaseSectionId,
    locationLead: PropertyShowcaseConfig['sections'][number]['locationLead']
  ) => void;
  setPalette: (palette: Partial<PropertyShowcaseConfig['palette']>) => void;
  setTypography: (typography: Partial<PropertyShowcaseConfig['typography']>) => void;
  setMotion: (motion: Partial<PropertyShowcaseConfig['motion']>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  markClean: () => void;
};

function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
}

function applyTemplateTypography(
  templateKey: ShowcaseTemplateKey,
  typography: PropertyShowcaseConfig['typography']
): PropertyShowcaseConfig['typography'] {
  if (templateKey === 'showcase-monolith') {
    return { ...typography, displayFont: 'instrument' };
  }
  if (templateKey === 'showcase-editorial') {
    return { ...typography, displayFont: 'cormorant' };
  }
  if (templateKey === 'showcase-haven') {
    return { ...typography, displayFont: 'fraunces' };
  }
  if (templateKey === 'showcase-verso') {
    return { ...typography, displayFont: 'outfit' };
  }
  if (templateKey === 'showcase-atlas') {
    return { ...typography, displayFont: 'jakarta' };
  }
  if (templateKey === 'showcase-aurora' && typography.displayFont === 'cormorant') {
    return { ...typography, displayFont: 'outfit' };
  }
  return typography;
}

const PALETTE_MODES = new Set<ShowcasePaletteMode>([
  'default',
  'brand',
  'media',
  'custom',
  ...SHOWCASE_PRESET_PALETTE_IDS,
]);

export function normalizeShowcaseConfig(config: PropertyShowcaseConfig): PropertyShowcaseConfig {
  const byId = new Map(config.sections.map((section) => [section.id, section]));
  const ordered = [...config.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => section.id)
    .filter((id, index, all) => all.indexOf(id) === index);

  for (const id of SHOWCASE_SECTION_IDS) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  return {
    version: 1,
    published: Boolean(config.published),
    palette: {
      mode: PALETTE_MODES.has(config.palette?.mode as ShowcasePaletteMode)
        ? (config.palette!.mode as ShowcasePaletteMode)
        : normalizeShowcasePaletteMode(config.palette?.mode),
      accent: config.palette?.accent ?? 'brand',
      customAccent: config.palette?.customAccent ?? null,
      customPaletteBase: config.palette?.customPaletteBase ?? null,
      overlay: config.palette?.overlay ?? 'soft',
    },
    typography: {
      displayFont: config.typography?.displayFont ?? 'jakarta',
      scale: config.typography?.scale ?? 'md',
    },
    motion: {
      intensity: config.motion?.intensity ?? 'standard',
      parallax: config.motion?.parallax ?? true,
      canvas: config.motion?.canvas ?? true,
    },
    sections: ordered.map((id, order) => {
      const existing = byId.get(id);
      return {
        id,
        order,
        visible: REQUIRED_VISIBLE.has(id) ? true : (existing?.visible ?? true),
        columns: existing?.columns,
        copy: existing?.copy,
        imageSlots: existing?.imageSlots,
        ctaLabel: existing?.ctaLabel,
        ctaTarget: existing?.ctaTarget,
        heroEyebrow: id === 'hero' ? existing?.heroEyebrow : undefined,
        locationLead: id === 'location' ? existing?.locationLead : undefined,
      };
    }),
  };
}

function pushHistory(state: PropertyShowcaseEditorState) {
  const next = state.history.slice(0, state.historyIndex + 1);
  next.push(
    cloneSnapshot({
      config: state.config,
      templateKey: state.templateKey,
    })
  );
  if (next.length > HISTORY_LIMIT) next.shift();
  state.history = next;
  state.historyIndex = next.length - 1;
}

const defaultSnapshot = (): Snapshot => ({
  config: defaultPropertyShowcaseConfig(),
  templateKey: 'showcase-aurora',
});

export const usePropertyShowcaseEditorStore = create<
  PropertyShowcaseEditorState & PropertyShowcaseEditorActions
>()(
  immer((set, get) => ({
    config: defaultPropertyShowcaseConfig(),
    templateKey: 'showcase-aurora',
    history: [defaultSnapshot()],
    historyIndex: 0,
    isDirty: false,
    hydrated: false,

    hydrate: (config, templateKey) =>
      set((state) => {
        const next = normalizeShowcaseConfig(config);
        next.typography = applyTemplateTypography(templateKey, next.typography);
        state.config = next;
        state.templateKey = templateKey;
        state.history = [cloneSnapshot({ config: next, templateKey })];
        state.historyIndex = 0;
        state.isDirty = false;
        state.hydrated = true;
      }),

    reset: () =>
      set((state) => {
        const snap = defaultSnapshot();
        state.config = snap.config;
        state.templateKey = snap.templateKey;
        state.history = [cloneSnapshot(snap)];
        state.historyIndex = 0;
        state.isDirty = false;
        state.hydrated = false;
      }),

    setTemplateKey: (templateKey) =>
      set((state) => {
        state.templateKey = templateKey;
        state.config.typography = applyTemplateTypography(templateKey, state.config.typography);
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionVisible: (id, visible) =>
      set((state) => {
        if (REQUIRED_VISIBLE.has(id)) return;
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.visible = visible;
        state.isDirty = true;
        pushHistory(state);
      }),

    reorderSections: (orderedIds) =>
      set((state) => {
        const byId = new Map(
          state.config.sections.map((section: PropertyShowcaseSectionConfig) => [
            section.id,
            section,
          ])
        );
        state.config.sections = orderedIds.map((id, order) => {
          const existing = byId.get(id)!;
          return { ...existing, order };
        });
        state.config = normalizeShowcaseConfig(state.config);
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionCopy: (id, copy) =>
      set((state) => {
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.copy = {
          heading: copy.heading?.trim() || undefined,
          subheading: copy.subheading?.trim() || undefined,
          body: copy.body?.trim() || undefined,
        };
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionColumns: (id, columns) =>
      set((state) => {
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.columns = Math.min(4, Math.max(1, Math.round(columns)));
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionImageSlots: (id, imageSlots) =>
      set((state) => {
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.imageSlots = imageSlots.slice(0, 12);
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionCta: (id, ctaLabel, ctaTarget) =>
      set((state) => {
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.ctaLabel = ctaLabel?.trim() || undefined;
        section.ctaTarget = ctaTarget?.trim() || undefined;
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionHeroEyebrow: (id, heroEyebrow) =>
      set((state) => {
        if (id !== 'hero') return;
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.heroEyebrow = heroEyebrow;
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionLocationLead: (id, locationLead) =>
      set((state) => {
        if (id !== 'location') return;
        const section = state.config.sections.find(
          (entry: PropertyShowcaseSectionConfig) => entry.id === id
        );
        if (!section) return;
        section.locationLead = locationLead;
        state.isDirty = true;
        pushHistory(state);
      }),

    setPalette: (palette) =>
      set((state) => {
        state.config.palette = { ...state.config.palette, ...palette };
        state.isDirty = true;
        pushHistory(state);
      }),

    setTypography: (typography) =>
      set((state) => {
        state.config.typography = { ...state.config.typography, ...typography };
        state.isDirty = true;
        pushHistory(state);
      }),

    setMotion: (motion) =>
      set((state) => {
        state.config.motion = { ...state.config.motion, ...motion };
        state.isDirty = true;
        pushHistory(state);
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        const previous = state.history[state.historyIndex];
        if (previous) {
          state.config = normalizeShowcaseConfig(previous.config);
          state.templateKey = previous.templateKey;
          state.isDirty = true;
        }
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        const next = state.history[state.historyIndex];
        if (next) {
          state.config = normalizeShowcaseConfig(next.config);
          state.templateKey = next.templateKey;
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
