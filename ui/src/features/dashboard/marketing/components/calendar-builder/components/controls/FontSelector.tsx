import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { NumberSlider } from './NumberSlider';
import { FONT_FAMILIES, type FontConfig } from '../../types';

interface FontSelectorProps {
  label?: string;
  value: FontConfig;
  onChange: (value: FontConfig) => void;
  showAdvanced?: boolean;
}

const FONT_WEIGHTS = [
  { value: 100, label: 'Thin' },
  { value: 200, label: 'Extra Light' },
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra Bold' },
  { value: 900, label: 'Black' },
];

const TEXT_TRANSFORMS = [
  { value: 'none', label: 'None' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Capitalize' },
];

export function FontSelector({ label, value, onChange, showAdvanced = false }: FontSelectorProps) {
  const updateFont = (key: keyof FontConfig, newValue: FontConfig[keyof FontConfig]) => {
    onChange({ ...value, [key]: newValue });
  };

  return (
    <div className="space-y-4">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      {/* Font Family */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Font Family</Label>
        <Select value={value.family} onValueChange={(v) => updateFont('family', v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((font) => (
              <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Size + Weight — stacked so the slider isn't crushed in narrow panels */}
      <NumberSlider
        label="Size"
        value={value.size}
        onChange={(v) => updateFont('size', v)}
        min={8}
        max={72}
        step={1}
      />

      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Weight</Label>
        <Select
          value={value.weight.toString()}
          onValueChange={(v) => updateFont('weight', parseInt(v) as FontConfig['weight'])}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_WEIGHTS.map((weight) => (
              <SelectItem key={weight.value} value={weight.value.toString()}>
                {weight.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <>
          <div className="space-y-3">
            <NumberSlider
              label="Line Height"
              value={value.lineHeight}
              onChange={(v) => updateFont('lineHeight', v)}
              min={0.8}
              max={3}
              step={0.1}
              unit=""
            />

            <NumberSlider
              label="Letter Spacing"
              value={value.letterSpacing}
              onChange={(v) => updateFont('letterSpacing', v)}
              min={-2}
              max={10}
              step={0.1}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Text Transform</Label>
            <Select
              value={value.textTransform}
              onValueChange={(v) => updateFont('textTransform', v as FontConfig['textTransform'])}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_TRANSFORMS.map((transform) => (
                  <SelectItem key={transform.value} value={transform.value}>
                    {transform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Preview */}
      <div className="border-border bg-muted/30 rounded-md border border-dashed p-3">
        <p
          className="text-center"
          style={{
            fontFamily: value.family,
            fontSize: `${Math.min(value.size, 24)}px`,
            fontWeight: value.weight,
            lineHeight: value.lineHeight,
            letterSpacing: `${value.letterSpacing}px`,
            textTransform: value.textTransform,
          }}
        >
          Preview Text
        </p>
      </div>
    </div>
  );
}
