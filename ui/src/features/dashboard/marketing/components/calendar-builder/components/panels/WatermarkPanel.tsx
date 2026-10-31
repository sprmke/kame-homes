import { Stamp } from 'lucide-react';

import { useCalendarPropertyMedia } from '@/features/dashboard/marketing/components/calendar-builder/components/CalendarPropertyMediaProvider';
import { PropertyImagePicker } from '@/features/dashboard/marketing/components/shared/PropertyImagePicker';

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
import { FontSelector, ColorPicker, NumberSlider } from '../controls';
import { StyleSection, StyleSubSection } from './StyleSection';

export function WatermarkPanel() {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const propertyImages = useCalendarPropertyMedia();
  const watermark = styles.watermark;

  const handleChange = (path: string, value: unknown) => {
    updateStyles(`watermark.${path}`, value);
  };

  return (
    <StyleSection title="Watermark" icon={<Stamp className="h-4 w-4" />}>
      <div className="flex items-center gap-2 py-2">
        <Checkbox
          id="watermark-show"
          checked={watermark.show}
          onCheckedChange={(checked) => {
            handleChange('show', checked);
            saveToHistory();
          }}
        />
        <Label htmlFor="watermark-show" className="text-sm">
          Show Watermark
        </Label>
      </div>

      {watermark.show && (
        <>
          <StyleSubSection title="Type">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Type</Label>
              <Select
                value={watermark.type}
                onValueChange={(value) => {
                  handleChange('type', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </StyleSubSection>

          {watermark.type === 'text' && (
            <StyleSubSection title="Text">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Text</Label>
                <Input
                  value={watermark.text || ''}
                  onChange={(e) => handleChange('text', e.target.value)}
                  onBlur={saveToHistory}
                  placeholder="Your brand"
                  className="h-9"
                />
              </div>
              {watermark.font && (
                <FontSelector
                  value={watermark.font}
                  onChange={(value) => {
                    handleChange('font', value);
                    saveToHistory();
                  }}
                />
              )}
            </StyleSubSection>
          )}

          {watermark.type === 'image' && (
            <StyleSubSection title="Image">
              <PropertyImagePicker
                images={propertyImages}
                selectedUrl={watermark.imageUrl ?? null}
                columns={2}
                onSelect={(url) => {
                  handleChange('imageUrl', url);
                  saveToHistory();
                }}
              />
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Image URL</Label>
                <Input
                  value={watermark.imageUrl || ''}
                  onChange={(e) => handleChange('imageUrl', e.target.value)}
                  onBlur={saveToHistory}
                  placeholder="https://example.com/logo.png"
                  className="h-9"
                />
              </div>
            </StyleSubSection>
          )}

          <StyleSubSection title="Appearance">
            <ColorPicker
              label="Color"
              value={watermark.color}
              onChange={(value) => {
                handleChange('color', value);
                saveToHistory();
              }}
            />
            <NumberSlider
              label="Opacity"
              value={watermark.opacity}
              onChange={(v) => {
                handleChange('opacity', v);
                saveToHistory();
              }}
              min={0}
              max={1}
              step={0.05}
              unit=""
            />
            <NumberSlider
              label="Size"
              value={watermark.size}
              onChange={(v) => {
                handleChange('size', v);
                saveToHistory();
              }}
              min={8}
              max={100}
            />
          </StyleSubSection>

          <StyleSubSection title="Position">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Select
                value={watermark.position}
                onValueChange={(value) => {
                  handleChange('position', value);
                  saveToHistory();
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </StyleSubSection>
        </>
      )}
    </StyleSection>
  );
}
