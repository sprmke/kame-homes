import { Grid3X3 } from 'lucide-react';

import { useCalendarBuilderStore } from '../../stores/calendarBuilderStore';
import { BackgroundControl, BorderControl, SpacingControl, NumberSlider } from '../controls';
import { StyleSection, StyleSubSection } from './StyleSection';

export function GridPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const grid = styles.grid;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`grid.${path}`, value);
  };

  return (
    <StyleSection title="Grid" icon={<Grid3X3 className="h-4 w-4" />}>
      {/* Gap */}
      <StyleSubSection title="Spacing">
        <NumberSlider
          label="Gap Between Cells"
          value={grid.gap}
          onChange={(v) => {
            handleChange('gap', v);
            saveToHistory();
          }}
          min={0}
          max={20}
        />
        <NumberSlider
          label="Border Radius"
          value={grid.borderRadius}
          onChange={(v) => {
            handleChange('borderRadius', v);
            saveToHistory();
          }}
          min={0}
          max={24}
        />
      </StyleSubSection>

      {/* Grid Container Padding - space around the entire grid */}
      <StyleSubSection title="Grid Outer Margin">
        <SpacingControl
          value={grid.padding}
          onChange={(value) => {
            handleChange('padding', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Background */}
      <StyleSubSection title="Background">
        <BackgroundControl
          value={grid.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Border */}
      <StyleSubSection title="Border">
        <BorderControl
          value={grid.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>
    </StyleSection>
  );
}
