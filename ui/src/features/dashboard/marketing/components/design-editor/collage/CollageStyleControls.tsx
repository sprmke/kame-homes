import { useCallback, useEffect, useRef, useState } from 'react';

import { ColorPicker } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/ColorPicker';
import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import { applyCollageStyle } from '@/features/dashboard/marketing/lib/collage/collageStoreOps';
import type { CollageSettings } from '@/features/dashboard/marketing/lib/collage/collageTypes';
import type { PolotnoStore } from '@/features/dashboard/marketing/lib/polotno/polotnoStore';

const STYLE_DEBOUNCE_MS = 120;

type Props = {
  store: PolotnoStore;
  settings: CollageSettings;
};

/**
 * Local draft state so a dragged slider feels instant, debounced 120ms before
 * it reaches the store — dragging a slider must not thrash the undo history
 * or relayout on every intermediate value.
 */
export function CollageStyleControls({ store, settings }: Props) {
  const [draft, setDraft] = useState(settings);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  const commit = useCallback(
    (patch: Partial<CollageSettings>) => {
      setDraft((prev) => ({ ...prev, ...patch }));
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void applyCollageStyle(store, patch);
      }, STYLE_DEBOUNCE_MS);
    },
    [store]
  );

  return (
    <div className="space-y-4">
      <NumberSlider
        label="Gap"
        value={draft.gap}
        min={0}
        max={60}
        step={1}
        onChange={(value) => commit({ gap: value })}
      />
      <NumberSlider
        label="Outer padding"
        value={draft.outerPadding}
        min={0}
        max={120}
        step={1}
        onChange={(value) => commit({ outerPadding: value })}
      />
      <NumberSlider
        label="Corner radius"
        value={draft.cornerRadius}
        min={0}
        max={80}
        step={1}
        onChange={(value) => commit({ cornerRadius: value })}
      />
      <NumberSlider
        label="Border size"
        value={draft.borderSize}
        min={0}
        max={20}
        step={1}
        onChange={(value) => commit({ borderSize: value })}
      />
      <ColorPicker
        label="Border color"
        value={draft.borderColor}
        onChange={(value) => commit({ borderColor: value })}
      />
      <ColorPicker
        label="Background"
        value={draft.backgroundColor}
        onChange={(value) => commit({ backgroundColor: value })}
      />
    </div>
  );
}
