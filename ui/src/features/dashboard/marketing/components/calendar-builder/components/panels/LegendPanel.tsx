import { List } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

export function LegendPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const legend = styles.legend;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`legend.${path}`, value);
  };

  return (
    <StyleSection title="Legend" icon={<List className="h-4 w-4" />}>
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="legend-show"
          checked={legend.show}
          onCheckedChange={(checked) => {
            handleChange('show', checked);
            saveToHistory();
          }}
        />
        <Label htmlFor="legend-show" className="text-sm">
          Show Legend
        </Label>
      </div>

      {legend.show && (
        <>
          <StyleSubSection title="Position">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Select
                value={legend.position}
                onValueChange={(value) => {
                  handleChange('position', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </StyleSubSection>

          <StyleSubSection title="Background">
            <BackgroundControl
              value={legend.background}
              onChange={(value) => {
                handleChange('background', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          <StyleSubSection title="Border">
            <BorderControl
              value={legend.border}
              onChange={(value) => {
                handleChange('border', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Border Radius"
              value={legend.borderRadius}
              onChange={(v) => {
                handleChange('borderRadius', v);
                saveToHistory();
              }}
              min={0}
              max={24}
            />
          </StyleSubSection>

          <StyleSubSection title="Padding">
            <SpacingControl
              value={legend.padding}
              onChange={(value) => {
                handleChange('padding', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          <StyleSubSection title="Title">
            <div className="flex items-center gap-2">
              <Checkbox
                id="legend-title-show"
                checked={legend.title.show}
                onCheckedChange={(checked) => {
                  handleChange('title.show', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="legend-title-show" className="text-xs">
                Show Title
              </Label>
            </div>

            {legend.title.show && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Text</Label>
                  <Input
                    value={legend.title.text}
                    onChange={(e) => handleChange('title.text', e.target.value)}
                    onBlur={saveToHistory}
                    placeholder="Legend"
                    className="h-9"
                  />
                </div>
                <FontSelector
                  value={legend.title.font}
                  onChange={(value) => {
                    handleChange('title.font', value);
                    saveToHistory();
                  }}
                />
                <ColorPicker
                  label="Color"
                  value={legend.title.color}
                  onChange={(value) => {
                    handleChange('title.color', value);
                    saveToHistory();
                  }}
                />
              </div>
            )}
          </StyleSubSection>

          <StyleSubSection title="Items">
            <NumberSlider
              label="Gap Between Items"
              value={legend.item.gap}
              onChange={(v) => {
                handleChange('item.gap', v);
                saveToHistory();
              }}
              min={8}
              max={48}
            />
            <FontSelector
              label="Label Font"
              value={legend.item.labelFont}
              onChange={(value) => {
                handleChange('item.labelFont', value);
                saveToHistory();
              }}
            />
            <ColorPicker
              label="Label Color"
              value={legend.item.labelColor}
              onChange={(value) => {
                handleChange('item.labelColor', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Indicator Size"
              value={legend.item.indicatorSize}
              onChange={(v) => {
                handleChange('item.indicatorSize', v);
                saveToHistory();
              }}
              min={8}
              max={32}
            />
            <NumberSlider
              label="Indicator Border Radius"
              value={legend.item.indicatorBorderRadius}
              onChange={(v) => {
                handleChange('item.indicatorBorderRadius', v);
                saveToHistory();
              }}
              min={0}
              max={16}
            />
          </StyleSubSection>
        </>
      )}
    </StyleSection>
  );
}
