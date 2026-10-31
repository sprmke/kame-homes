import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ColorPicker } from './ColorPicker';
import { NumberSlider } from './NumberSlider';
import { type BorderConfig } from '../../types';

interface BorderControlProps {
  label?: string;
  value: BorderConfig;
  onChange: (value: BorderConfig) => void;
}

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'double', label: 'Double' },
];

export function BorderControl({ label, value, onChange }: BorderControlProps) {
  const updateBorder = (key: keyof BorderConfig, newValue: BorderConfig[keyof BorderConfig]) => {
    onChange({ ...value, [key]: newValue });
  };

  return (
    <div className="space-y-4">
      {label && <Label className="text-sm font-medium">{label}</Label>}

      {/* Style */}
      <div className="space-y-1.5">
        <Label className="text-muted-foreground text-xs">Style</Label>
        <Select
          value={value.style}
          onValueChange={(v) => updateBorder('style', v as BorderConfig['style'])}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BORDER_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.style !== 'none' && (
        <>
          {/* Width */}
          <NumberSlider
            label="Width"
            value={value.width}
            onChange={(v) => updateBorder('width', v)}
            min={0}
            max={10}
            step={1}
          />

          {/* Color */}
          <ColorPicker
            label="Color"
            value={value.color}
            onChange={(v) => updateBorder('color', v)}
          />

          {/* Radius */}
          <NumberSlider
            label="Radius"
            value={value.radius}
            onChange={(v) => updateBorder('radius', v)}
            min={0}
            max={50}
            step={1}
          />
        </>
      )}

      {/* Preview */}
      <div className="flex items-center justify-center py-2">
        <div
          className="bg-muted/30 h-12 w-24"
          style={{
            borderWidth: value.width,
            borderStyle: value.style,
            borderColor: value.color,
            borderRadius: value.radius,
          }}
        />
      </div>
    </div>
  );
}
