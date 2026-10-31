import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';
import {
  defaultStayGuideConfigV2,
  isStayGuideChapterSectionId,
  normalizeStayGuideConfigV2,
  STAY_GUIDE_REQUIRED_VISIBLE,
  type StayGuideChapterSectionId,
  type StayGuideConfigV2,
  type StayGuideSectionConfigEntry,
  type StayGuideSectionId,
} from '@/features/guest/stay-guide/lib/stayGuideConfig';

const HISTORY_LIMIT = 50;

type Snapshot = { config: StayGuideConfigV2; templateKey: ShowcaseTemplateKey };

type State = {
  config: StayGuideConfigV2;
  templateKey: ShowcaseTemplateKey;
  history: Snapshot[];
  historyIndex: number;
  isDirty: boolean;
  hydrated: boolean;
};

type Actions = {
  hydrate: (config: StayGuideConfigV2, templateKey: ShowcaseTemplateKey) => void;
  reset: () => void;
  setTemplateKey: (templateKey: ShowcaseTemplateKey) => void;
  setSectionVisible: (id: StayGuideSectionId, visible: boolean) => void;
  setChapterVisible: (id: StayGuideChapterSectionId, visible: boolean) => void;
  reorderSections: (orderedIds: StayGuideSectionId[]) => void;
  reorderChapters: (orderedIds: StayGuideChapterSectionId[]) => void;
  setSectionCopy: (
    id: StayGuideSectionId,
    copy: { heading?: string; subheading?: string; body?: string }
  ) => void;
  setSectionImageSlots: (id: StayGuideSectionId, imageSlots: string[]) => void;
  setSectionHeroEyebrow: (
    id: StayGuideSectionId,
    heroEyebrow: StayGuideSectionConfigEntry['heroEyebrow']
  ) => void;
  setSectionAccent: (id: StayGuideSectionId, accentColor: string | null) => void;
  setPalette: (palette: Partial<StayGuideConfigV2['palette']>) => void;
  setTypography: (typography: Partial<StayGuideConfigV2['typography']>) => void;
  setMotion: (motion: Partial<StayGuideConfigV2['motion']>) => void;
  undo: () => void;
  redo: () => void;
  markClean: () => void;
};

function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
}

/** Per-template display font, mirroring `applyTemplateTypography` for Showcase. */
function applyTemplateTypography(
  templateKey: ShowcaseTemplateKey,
  typography: StayGuideConfigV2['typography']
): StayGuideConfigV2['typography'] {
  switch (templateKey) {
    case 'showcase-monolith':
      return { ...typography, displayFont: 'instrument' };
    case 'showcase-editorial':
      return { ...typography, displayFont: 'cormorant' };
    case 'showcase-haven':
      return { ...typography, displayFont: 'fraunces' };
    case 'showcase-verso':
      return { ...typography, displayFont: 'outfit' };
    case 'showcase-atlas':
      return { ...typography, displayFont: 'jakarta' };
    default:
      return typography.displayFont === 'cormorant'
        ? { ...typography, displayFont: 'outfit' }
        : typography;
  }
}

function pushHistory(state: State) {
  const next = state.history.slice(0, state.historyIndex + 1);
  next.push(cloneSnapshot({ config: state.config, templateKey: state.templateKey }));
  if (next.length > HISTORY_LIMIT) next.shift();
  state.history = next;
  state.historyIndex = next.length - 1;
}

function findSection(
  state: State,
  id: StayGuideSectionId
): StayGuideSectionConfigEntry | undefined {
  return state.config.sections.find((entry) => entry.id === id);
}

const defaultSnapshot = (): Snapshot => ({
  config: defaultStayGuideConfigV2(),
  templateKey: 'showcase-aurora',
});

export const useStayGuideEditorStore = create<State & Actions>()(
  immer((set) => ({
    config: defaultStayGuideConfigV2(),
    templateKey: 'showcase-aurora',
    history: [defaultSnapshot()],
    historyIndex: 0,
    isDirty: false,
    hydrated: false,

    hydrate: (config, templateKey) =>
      set((state) => {
        const next = normalizeStayGuideConfigV2(config);
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
        if (STAY_GUIDE_REQUIRED_VISIBLE.has(id)) return;
        const section = findSection(state, id);
        if (!section) return;
        section.visible = visible;
        state.isDirty = true;
        pushHistory(state);
      }),

    setChapterVisible: (id, visible) =>
      set((state) => {
        const section = findSection(state, id);
        if (!section) return;
        section.visible = visible;
        state.isDirty = true;
        pushHistory(state);
      }),

    reorderSections: (orderedIds) =>
      set((state) => {
        const byId = new Map(
          state.config.sections.map((entry: StayGuideSectionConfigEntry) => [entry.id, entry])
        );
        state.config.sections = orderedIds
          .map((id, order) => {
            const existing = byId.get(id);
            return existing ? { ...existing, order } : null;
          })
          .filter((entry): entry is StayGuideSectionConfigEntry => Boolean(entry));
        state.config = normalizeStayGuideConfigV2(state.config);
        state.isDirty = true;
        pushHistory(state);
      }),

    reorderChapters: (orderedIds) =>
      set((state) => {
        const byId = new Map(
          state.config.sections
            .filter((entry: StayGuideSectionConfigEntry) => isStayGuideChapterSectionId(entry.id))
            .map((entry: StayGuideSectionConfigEntry) => [entry.id, entry])
        );
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((entry): entry is StayGuideSectionConfigEntry => Boolean(entry));
        let chapterIndex = 0;
        state.config.sections = state.config.sections.map((entry: StayGuideSectionConfigEntry) => {
          if (!isStayGuideChapterSectionId(entry.id)) return entry;
          return reordered[chapterIndex++] ?? entry;
        });
        state.config = normalizeStayGuideConfigV2(state.config);
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionCopy: (id, copy) =>
      set((state) => {
        const section = findSection(state, id);
        if (!section) return;
        section.copy = {
          heading: copy.heading?.trim() || undefined,
          subheading: copy.subheading?.trim() || undefined,
          body: copy.body?.trim() || undefined,
        };
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionImageSlots: (id, imageSlots) =>
      set((state) => {
        const section = findSection(state, id);
        if (!section) return;
        section.imageSlots = imageSlots.slice(0, 24);
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionHeroEyebrow: (id, heroEyebrow) =>
      set((state) => {
        if (id !== 'hero') return;
        const section = findSection(state, id);
        if (!section) return;
        section.heroEyebrow = heroEyebrow;
        state.isDirty = true;
        pushHistory(state);
      }),

    setSectionAccent: (id, accentColor) =>
      set((state) => {
        if (!isStayGuideChapterSectionId(id)) return;
        const section = findSection(state, id);
        if (!section) return;
        section.accentColor = accentColor;
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
          state.config = normalizeStayGuideConfigV2(previous.config);
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
          state.config = normalizeStayGuideConfigV2(next.config);
          state.templateKey = next.templateKey;
          state.isDirty = true;
        }
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),
  }))
);
