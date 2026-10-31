import { Columns } from 'lucide-react';

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
} from '../controls';
import { StyleSection, StyleSubSection } from './StyleSection';

export function DayNamesPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const dayNames = styles.dayNames;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`dayNames.${path}`, value);
  };

  return (
    <StyleSection title="Day Names" icon={<Columns className="h-4 w-4" />}>
      {/* Show/Hide */}
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="daynames-show"
          checked={dayNames.show}
          onCheckedChange={(checked) => {
            handleChange('show', checked);
            saveToHistory();
          }}
        />
        <Label htmlFor="daynames-show" className="text-sm">
          Show Day Names
        </Label>
      </div>

      {dayNames.show && (
        <>
          {/* Format */}
          <StyleSubSection title="Display Format">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Format</Label>
              <Select
                value={dayNames.format}
                onValueChange={(value) => {
                  handleChange('format', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full (Sunday)</SelectItem>
                  <SelectItem value="short">Short (Sun)</SelectItem>
                  <SelectItem value="narrow">Narrow (S)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Alignment</Label>
              <Select
                value={dayNames.alignment}
                onValueChange={(value) => {
                  handleChange('alignment', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </StyleSubSection>

          {/* Typography */}
          <StyleSubSection title="Typography">
            <FontSelector
              value={dayNames.font}
              onChange={(value) => {
                handleChange('font', value);
                saveToHistory();
              }}
              showAdvanced
            />
            <ColorPicker
              label="Text Color"
              value={dayNames.color}
              onChange={(value) => {
                handleChange('color', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          {/* Background */}
          <StyleSubSection title="Background">
            <BackgroundControl
              value={dayNames.background}
              onChange={(value) => {
                handleChange('background', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          {/* Border */}
          <StyleSubSection title="Border">
            <BorderControl
              value={dayNames.border}
              onChange={(value) => {
                handleChange('border', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          {/* Padding */}
          <StyleSubSection title="Padding">
            <SpacingControl
              value={dayNames.padding}
              onChange={(value) => {
                handleChange('padding', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>
        </>
      )}
    </StyleSection>
  );
}
