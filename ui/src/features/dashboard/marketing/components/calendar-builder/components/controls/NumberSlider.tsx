import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NumberSliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function NumberSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = 'px',
}: NumberSliderProps) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const inputValue = draftValue ?? value.toString();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDraftValue(newValue);

    const numValue = parseFloat(newValue);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    setDraftValue(null);
    onChange(numValue);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setDraftValue(null);
    } else {
      const clampedValue = Math.min(max, Math.max(min, numValue));
      setDraftValue(null);
      onChange(clampedValue);
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <Label className="text-muted-foreground text-xs">{label}</Label>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {value}
            {unit}
          </span>
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="bg-muted [&::-webkit-slider-thumb]:bg-primary h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />

        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            min={min}
            max={max}
            step={step}
            className="h-8 w-14 text-center text-xs"
            aria-label={label ? `${label} value` : 'Numeric value'}
          />
          {unit ? <span className="text-muted-foreground w-5 text-xs">{unit}</span> : null}
        </div>
      </div>
    </div>
  );
}
