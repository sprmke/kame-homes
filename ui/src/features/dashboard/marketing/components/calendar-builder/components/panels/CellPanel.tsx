import { LayoutGrid } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCalendarBuilderStore } from '../../stores/calendarBuilderStore';
import {
  BackgroundControl,
  BorderControl,
  SpacingControl,
  FontSelector,
  ColorPicker,
  NumberSlider,
} from '../controls';
import { StyleSection, StyleSubSection } from './StyleSection';

export function CellPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const cell = styles.cell;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`cell.${path}`, value);
  };

  return (
    <StyleSection title="Day Cells" icon={<LayoutGrid className="h-4 w-4" />}>
      {/* Dimensions */}
      <StyleSubSection title="Dimensions">
        <NumberSlider
          label="Min Height"
          value={cell.minHeight}
          onChange={(v) => {
            handleChange('minHeight', v);
            saveToHistory();
          }}
          min={40}
          max={150}
        />
        <NumberSlider
          label="Border Radius"
          value={cell.borderRadius}
          onChange={(v) => {
            handleChange('borderRadius', v);
            saveToHistory();
          }}
          min={0}
          max={50}
        />
      </StyleSubSection>

      {/* Background */}
      <StyleSubSection title="Background">
        <BackgroundControl
          value={cell.background}
          onChange={(value) => {
            handleChange('background', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Border */}
      <StyleSubSection title="Border">
        <BorderControl
          value={cell.border}
          onChange={(value) => {
            handleChange('border', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Cell Inner Padding - space inside each day cell */}
      <StyleSubSection title="Cell Inner Padding">
        <SpacingControl
          value={cell.padding}
          onChange={(value) => {
            handleChange('padding', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Day Number */}
      <StyleSubSection title="Day Number">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground text-xs">Position</Label>
          <Select
            value={cell.dayNumber.position}
            onValueChange={(value) => {
              handleChange('dayNumber.position', value);
              saveToHistory();
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-center">Top Center</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="center">Center</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <FontSelector
          value={cell.dayNumber.font}
          onChange={(value) => {
            handleChange('dayNumber.font', value);
            saveToHistory();
          }}
        />
        <ColorPicker
          label="Text Color"
          value={cell.dayNumber.color}
          onChange={(value) => {
            handleChange('dayNumber.color', value);
            saveToHistory();
          }}
        />
      </StyleSubSection>

      {/* Hover State */}
      <StyleSubSection title="Hover State">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hover-enabled"
            checked={cell.hover.enabled}
            onCheckedChange={(checked) => {
              handleChange('hover.enabled', checked);
              saveToHistory();
            }}
          />
          <Label htmlFor="hover-enabled" className="text-xs">
            Enable Hover Effect
          </Label>
        </div>

        {cell.hover.enabled && (
          <div className="mt-3 space-y-3">
            <ColorPicker
              label="Hover Background"
              value={cell.hover.background}
              onChange={(value) => {
                handleChange('hover.background', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Hover Border Color"
              value={cell.hover.borderColor}
              onChange={(value) => {
                handleChange('hover.borderColor', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Scale"
              value={cell.hover.scale}
              onChange={(v) => {
                handleChange('hover.scale', v);
                saveToHistory();
              }}
              min={1}
              max={1.2}
              step={0.01}
              unit=""
            />
            <NumberSlider
              label="Transition Duration"
              value={cell.hover.transition}
              onChange={(v) => {
                handleChange('hover.transition', v);
                saveToHistory();
              }}
              min={0}
              max={500}
              unit="ms"
            />
          </div>
        )}
      </StyleSubSection>

      {/* Empty Cell */}
      <StyleSubSection title="Empty Cells">
        <BackgroundControl
          value={cell.empty.background}
          onChange={(value) => {
            handleChange('empty.background', value);
            saveToHistory();
          }}
        />
        <NumberSlider
          label="Opacity"
          value={cell.empty.opacity}
          onChange={(v) => {
            handleChange('empty.opacity', v);
            saveToHistory();
          }}
          min={0}
          max={1}
          step={0.1}
          unit=""
        />
      </StyleSubSection>
    </StyleSection>
  );
}
