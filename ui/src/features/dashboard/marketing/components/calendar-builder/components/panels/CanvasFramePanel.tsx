import { Frame } from 'lucide-react';

import {
  BackgroundControl,
  NumberSlider,
} from '@/features/dashboard/marketing/components/calendar-builder/components/controls';
import {
  StyleSection,
  StyleSubSection,
} from '@/features/dashboard/marketing/components/calendar-builder/components/panels/StyleSection';
import { useCalendarBuilderStore } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import { normalizeCalendarCanvasFrame } from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

export function CanvasFramePanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame);

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`canvasFrame.${path}`, value);
  };

  return (
    <StyleSection title="Canvas" icon={<Frame className="size-4" />} defaultOpen>
      <StyleSubSection title="Background">
        <BackgroundControl
          value={frame.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      <StyleSubSection title="Layout">
        <NumberSlider
          label="Padding"
          value={frame.padding}
          onChange={(value) => {
            handleChange('padding', value);
            saveToHistory();
          }}
          min={0}
          max={240}
          step={4}
        />
        <NumberSlider
          label="Calendar size"
          value={frame.calendarScale}
          onChange={(value) => {
            handleChange('calendarScale', value);
            saveToHistory();
          }}
          min={55}
          max={100}
          step={1}
        />
      </StyleSubSection>
    </StyleSection>
  );
}
