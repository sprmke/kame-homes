import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { CALENDAR_PRESET_STYLES } from '@/features/dashboard/marketing/lib/calendarPresets';

import {
  type CalendarStyles,
  type CalendarBuilderState,
  type PreviewBooking,
  createDefaultStyles,
  normalizeCalendarStyles,
} from '../types';

// ========================================
// Store Actions Interface
// ========================================
interface CalendarBuilderActions {
  // Style updates
  setStyles: (styles: CalendarStyles, options?: { markDirty?: boolean }) => void;
  /** Open a document: styles + locks become the clean starting point (fresh undo, not dirty). */
  loadStyles: (styles: CalendarStyles, lockedPaths?: string[]) => void;
  /** Advanced-panel edit. The path is also locked so theme changes leave it alone. */
  updateStyles: (path: string, value: unknown) => void;
  /** Paths the host set by hand (saved with the item; see `rethemeCalendarStyles`). */
  setLockedPaths: (paths: string[]) => void;

  // Section navigation
  setActiveSection: (section: string | null) => void;
  setActiveSubSection: (subSection: string | null) => void;

  // Preview controls
  setPreviewMonth: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;

  // Export controls
  setExportFormat: (format: 'png' | 'jpeg' | 'webp') => void;
  setExportQuality: (quality: number) => void;
  setIsExporting: (isExporting: boolean) => void;

  // History (undo/redo)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;

  // Dirty state
  setIsDirty: (isDirty: boolean) => void;
}

// ========================================
// Combined Store Type
// ========================================
type CalendarBuilderStore = CalendarBuilderState & {
  lockedPaths: string[];
} & CalendarBuilderActions;

// ========================================
// Helper: Deep set value by path
// ========================================
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!key) continue;
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
}

// Preset styles — see lib/calendarPresets.ts (12 designer templates)
const presets: Record<string, Partial<CalendarStyles>> = CALENDAR_PRESET_STYLES;

// ========================================
// Mock Preview Data
// ========================================
export const MOCK_PREVIEW_BOOKINGS: PreviewBooking[] = [
  { id: '1', guestName: 'John Smith', startDay: 5, endDay: 8, status: 'confirmed' },
  { id: '2', guestName: 'Sarah Johnson', startDay: 12, endDay: 14, status: 'checkedIn' },
  { id: '3', guestName: 'Mike Williams', startDay: 20, endDay: 25, status: 'pending' },
];

export const MOCK_BLOCKED_DAYS = [1, 2, 28, 29, 30];

export function resolveCalendarPresetStyles(preset: string): CalendarStyles {
  if (preset === 'default') {
    return createDefaultStyles();
  }

  const presetStyles = presets[preset];
  if (!presetStyles) {
    return createDefaultStyles();
  }

  const defaultStyles = createDefaultStyles();
  return normalizeCalendarStyles({
    ...defaultStyles,
    ...presetStyles,
    container: { ...defaultStyles.container, ...presetStyles.container },
    header: { ...defaultStyles.header, ...presetStyles.header },
    dayNames: { ...defaultStyles.dayNames, ...presetStyles.dayNames },
    grid: { ...defaultStyles.grid, ...presetStyles.grid },
    cell: { ...defaultStyles.cell, ...presetStyles.cell },
    today: { ...defaultStyles.today, ...presetStyles.today },
    booked: { ...defaultStyles.booked, ...presetStyles.booked },
    available: { ...defaultStyles.available, ...presetStyles.available },
    blocked: { ...defaultStyles.blocked, ...presetStyles.blocked },
    bookingBar: { ...defaultStyles.bookingBar, ...presetStyles.bookingBar },
    legend: { ...defaultStyles.legend, ...presetStyles.legend },
    watermark: { ...defaultStyles.watermark, ...presetStyles.watermark },
  } as CalendarStyles);
}

// ========================================
// Create Store
// ========================================
export const useCalendarBuilderStore = create<CalendarBuilderStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      styles: createDefaultStyles(),
      activeSection: null,
      activeSubSection: null,
      previewMonth: new Date(),
      isDirty: false,
      isExporting: false,
      exportFormat: 'png',
      exportQuality: 1,
      history: [createDefaultStyles()],
      historyIndex: 0,
      lockedPaths: [],

      // Actions
      setStyles: (styles, options) =>
        set((state) => {
          state.styles = normalizeCalendarStyles(styles);
          if (options?.markDirty !== false) {
            state.isDirty = true;
          }
        }),

      loadStyles: (styles, lockedPaths = []) =>
        set((state) => {
          const normalized = normalizeCalendarStyles(styles);
          state.styles = normalized;
          state.lockedPaths = [...new Set(lockedPaths)];
          state.history = [JSON.parse(JSON.stringify(normalized))];
          state.historyIndex = 0;
          state.isDirty = false;
        }),

      updateStyles: (path, value) =>
        set((state) => {
          setNestedValue(state.styles as unknown as Record<string, unknown>, path, value);
          if (!state.lockedPaths.includes(path)) state.lockedPaths.push(path);
          state.isDirty = true;
        }),

      setLockedPaths: (paths) =>
        set((state) => {
          state.lockedPaths = [...new Set(paths)];
        }),

      setActiveSection: (section) =>
        set((state) => {
          state.activeSection = section;
          state.activeSubSection = null;
        }),

      setActiveSubSection: (subSection) =>
        set((state) => {
          state.activeSubSection = subSection;
        }),

      setPreviewMonth: (date) =>
        set((state) => {
          state.previewMonth = date;
        }),

      nextMonth: () =>
        set((state) => {
          const current = new Date(state.previewMonth);
          current.setMonth(current.getMonth() + 1);
          state.previewMonth = current;
        }),

      prevMonth: () =>
        set((state) => {
          const current = new Date(state.previewMonth);
          current.setMonth(current.getMonth() - 1);
          state.previewMonth = current;
        }),

      setExportFormat: (format) =>
        set((state) => {
          state.exportFormat = format;
        }),

      setExportQuality: (quality) =>
        set((state) => {
          state.exportQuality = quality;
        }),

      setIsExporting: (isExporting) =>
        set((state) => {
          state.isExporting = isExporting;
        }),

      undo: () =>
        set((state) => {
          if (state.historyIndex > 0) {
            state.historyIndex -= 1;
            const previousStyles = state.history[state.historyIndex];
            if (previousStyles) {
              state.styles = previousStyles;
              state.isDirty = true;
            }
          }
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex < state.history.length - 1) {
            state.historyIndex += 1;
            const nextStyles = state.history[state.historyIndex];
            if (nextStyles) {
              state.styles = nextStyles;
              state.isDirty = true;
            }
          }
        }),

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { historyIndex, history } = get();
        return historyIndex < history.length - 1;
      },

      saveToHistory: () =>
        set((state) => {
          // Remove any future history if we're not at the end
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(JSON.parse(JSON.stringify(state.styles)));

          // Limit history to 50 entries
          if (newHistory.length > 50) {
            newHistory.shift();
          }

          state.history = newHistory;
          state.historyIndex = newHistory.length - 1;
        }),

      setIsDirty: (isDirty) =>
        set((state) => {
          state.isDirty = isDirty;
        }),
    })),
    {
      name: 'calendar-builder-storage',
      partialize: (state) => ({
        styles: state.styles,
        exportFormat: state.exportFormat,
        exportQuality: state.exportQuality,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<typeof current> | undefined;
        const styles = saved?.styles
          ? normalizeCalendarStyles(saved.styles as CalendarStyles)
          : current.styles;
        return {
          ...current,
          ...saved,
          styles,
        };
      },
    }
  )
);
