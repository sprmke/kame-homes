import { PanelTop } from 'lucide-react';

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

export function HeaderPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const header = styles.header;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`header.${path}`, value);
  };

  return (
    <StyleSection title="Header" icon={<PanelTop className="h-4 w-4" />}>
      {/* Show/Hide Header */}
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="header-show"
          checked={header.show}
          onCheckedChange={(checked) => {
            handleChange('show', checked);
            saveToHistory();
          }}
        />
        <Label htmlFor="header-show" className="text-sm">
          Show Header
        </Label>
      </div>

      {header.show && (
        <>
          {/* Background & Border */}
          <StyleSubSection title="Background & Border">
            <BackgroundControl
              value={header.background}
              onChange={(value) => {
                handleChange('background', value);
                saveToHistory();
              }}
            />
            <div className="mt-4">
              <BorderControl
                value={header.border}
                onChange={(value) => {
                  handleChange('border', value);
                  saveToHistory();
                }}
              />
            </div>
          </StyleSubSection>

          {/* Padding */}
          <StyleSubSection title="Padding">
            <SpacingControl
              value={header.padding}
              onChange={(value) => {
                handleChange('padding', value);
                saveToHistory();
              }}
            />
          </StyleSubSection>

          {/* Property Name */}
          <StyleSubSection title="Property Name">
            <div className="flex items-center gap-2">
              <Checkbox
                id="property-name-show"
                checked={header.propertyName.show}
                onCheckedChange={(checked) => {
                  handleChange('propertyName.show', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="property-name-show" className="text-xs">
                Show Property Name
              </Label>
            </div>

            {header.propertyName.show && (
              <div className="mt-3 space-y-3">
                <FontSelector
                  value={header.propertyName.font}
                  onChange={(value) => {
                    handleChange('propertyName.font', value);
                    saveToHistory();
                  }}
                />
                <ColorPicker
                  label="Color"
                  value={header.propertyName.color}
                  onChange={(value) => {
                    handleChange('propertyName.color', value);
                    saveToHistory();
                  }}
                />
              </div>
            )}
          </StyleSubSection>

          {/* Month/Year Display */}
          <StyleSubSection title="Month/Year">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Format</Label>
                <Select
                  value={header.monthYear.format}
                  onValueChange={(value) => {
                    handleChange('monthYear.format', value);
                    saveToHistory();
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MMMM YYYY">January 2026</SelectItem>
                    <SelectItem value="MMM YYYY">Jan 2026</SelectItem>
                    <SelectItem value="MM/YYYY">01/2026</SelectItem>
                    <SelectItem value="YYYY-MM">2026-01</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FontSelector
                value={header.monthYear.font}
                onChange={(value) => {
                  handleChange('monthYear.font', value);
                  saveToHistory();
                }}
              />
              <ColorPicker
                label="Color"
                value={header.monthYear.color}
                onChange={(value) => {
                  handleChange('monthYear.color', value);
                  saveToHistory();
                }}
              />
            </div>
          </StyleSubSection>

          {/* Navigation Buttons */}
          <StyleSubSection title="Navigation">
            <div className="flex items-center gap-2">
              <Checkbox
                id="navigation-show"
                checked={header.navigation.show}
                onCheckedChange={(checked) => {
                  handleChange('navigation.show', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="navigation-show" className="text-xs">
                Show Navigation Buttons
              </Label>
            </div>

            {header.navigation.show && (
              <div className="mt-3 space-y-3">
                <NumberSlider
                  label="Button Size"
                  value={header.navigation.buttonSize}
                  onChange={(v) => {
                    handleChange('navigation.buttonSize', v);
                    saveToHistory();
                  }}
                  min={24}
                  max={56}
                />
                <ColorPicker
                  label="Button Background"
                  value={header.navigation.buttonBackground}
                  onChange={(value) => {
                    handleChange('navigation.buttonBackground', value);
                    saveToHistory();
                  }}
                />
                <ColorPicker
                  label="Button Icon Color"
                  value={header.navigation.buttonColor}
                  onChange={(value) => {
                    handleChange('navigation.buttonColor', value);
                    saveToHistory();
                  }}
                />
                <ColorPicker
                  label="Hover Background"
                  value={header.navigation.hoverBackground}
                  onChange={(value) => {
                    handleChange('navigation.hoverBackground', value);
                    saveToHistory();
                  }}
                />
                <BorderControl
                  label="Button Border"
                  value={header.navigation.buttonBorder}
                  onChange={(value) => {
                    handleChange('navigation.buttonBorder', value);
                    saveToHistory();
                  }}
                />
              </div>
            )}
          </StyleSubSection>

          {/* Subtitle */}
          <StyleSubSection title="Subtitle">
            <div className="flex items-center gap-2">
              <Checkbox
                id="subtitle-show"
                checked={header.subtitle.show}
                onCheckedChange={(checked) => {
                  handleChange('subtitle.show', checked);
                  saveToHistory();
                }}
              />
              <Label htmlFor="subtitle-show" className="text-xs">
                Show Subtitle
              </Label>
            </div>

            {header.subtitle.show && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Text</Label>
                  <Input
                    value={header.subtitle.text}
                    onChange={(e) => handleChange('subtitle.text', e.target.value)}
                    onBlur={saveToHistory}
                    placeholder="Enter subtitle text"
                    className="h-9"
                  />
                </div>
                <FontSelector
                  value={header.subtitle.font}
                  onChange={(value) => {
                    handleChange('subtitle.font', value);
                    saveToHistory();
                  }}
                />
                <ColorPicker
                  label="Color"
                  value={header.subtitle.color}
                  onChange={(value) => {
                    handleChange('subtitle.color', value);
                    saveToHistory();
                  }}
                />
              </div>
            )}
          </StyleSubSection>
        </>
      )}
    </StyleSection>
  );
}
