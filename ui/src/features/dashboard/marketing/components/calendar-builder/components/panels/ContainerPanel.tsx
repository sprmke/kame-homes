import { Square } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useCalendarBuilderStore } from '../../stores/calendarBuilderStore';
import {
  BackgroundControl,
  BorderControl,
  SpacingControl,
  NumberSlider,
  ColorPicker,
} from '../controls';
import { StyleSection, StyleSubSection } from './StyleSection';

export function ContainerPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const container = styles.container;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`container.${path}`, value);
  };

  return (
    <StyleSection title="Container" icon={<Square className="h-4 w-4" />} defaultOpen>
      {/* Background */}
      <StyleSubSection title="Background">
        <BackgroundControl
          value={container.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Border */}
      <StyleSubSection title="Border">
        <BorderControl
          value={container.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Shadow */}
      <StyleSubSection title="Shadow">
        <div className="flex items-center gap-2">
          <Checkbox
            id="shadow-enabled"
            checked={container.shadow.enabled}
            onCheckedChange={(checked) => {
              handleChange('shadow.enabled', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="shadow-enabled" className="text-xs">
            Enable Shadow
          </Label>
        </div>

        {container.shadow.enabled && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumberSlider
                label="X Offset"
                value={container.shadow.x}
                onChange={(v) => handleChange('shadow.x', v)}
                min={-50}
                max={50}
              />
              <NumberSlider
                label="Y Offset"
                value={container.shadow.y}
                onChange={(v) => handleChange('shadow.y', v)}
                min={-50}
                max={50}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberSlider
                label="Blur"
                value={container.shadow.blur}
                onChange={(v) => handleChange('shadow.blur', v)}
                min={0}
                max={100}
              />
              <NumberSlider
                label="Spread"
                value={container.shadow.spread}
                onChange={(v) => handleChange('shadow.spread', v)}
                min={-50}
                max={50}
              />
            </div>
            <ColorPicker
              label="Shadow Color"
              value={container.shadow.color}
              onChange={(v) => {
                handleChange('shadow.color', v);
                saveToHistory();
              }}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="shadow-inset"
                checked={container.shadow.inset}
                onCheckedChange={(checked) => handleChange('shadow.inset', checked)}
              />
              <Label htmlFor="shadow-inset" className="text-xs">
                Inset Shadow
              </Label>
            </div>
          </div>
        )}
      </StyleSubSection>

      {/* Spacing */}
      <StyleSubSection title="Padding">
        <SpacingControl
          value={container.padding}
          onChange={(value) => {
            handleChange('padding', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Dimensions */}
      <StyleSubSection title="Dimensions">
        <NumberSlider
          label="Max Width"
          value={container.maxWidth}
          onChange={(v) => {
            handleChange('maxWidth', v);
            saveToHistory();
          }}
          min={400}
          max={1400}
          step={10}
        />
        <NumberSlider
          label="Border Radius"
          value={container.border.radius}
          onChange={(v) => {
            handleChange('border.radius', v);
            saveToHistory();
          }}
          min={0}
          max={50}
        />
      </StyleSubSection>
    </StyleSection>
  );
}
