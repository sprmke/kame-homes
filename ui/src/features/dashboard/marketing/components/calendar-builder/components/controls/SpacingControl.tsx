import { useState } from 'react';

import { Link, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { type SpacingConfig } from '../../types';

interface SpacingControlProps {
  label?: string;
  value: SpacingConfig;
  onChange: (value: SpacingConfig) => void;
  max?: number;
}

export function SpacingControl({ label, value, onChange, max = 100 }: SpacingControlProps) {
  const [isLinked, setIsLinked] = useState(
    value.top === value.right && value.right === value.bottom && value.bottom === value.left
  );

  const handleChange = (side: keyof SpacingConfig, newValue: number) => {
    if (isLinked) {
      onChange({
        top: newValue,
        right: newValue,
        bottom: newValue,
        left: newValue,
      });
    } else {
      onChange({ ...value, [side]: newValue });
    }
  };

  const handleInputChange = (side: keyof SpacingConfig, inputValue: string) => {
    const numValue = parseInt(inputValue) || 0;
    const clampedValue = Math.min(max, Math.max(0, numValue));
    handleChange(side, clampedValue);
  };

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs">{label}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!isLinked) {
                // When linking, set all to the top value
                onChange({
                  top: value.top,
                  right: value.top,
                  bottom: value.top,
                  left: value.top,
                });
              }
              setIsLinked(!isLinked);
            }}
            className="h-6 w-6 p-0"
          >
            {isLinked ? (
              <Link className="text-primary h-3.5 w-3.5" />
            ) : (
              <Unlink className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-[10px]">Top</Label>
          <Input
            type="number"
            value={value.top}
            onChange={(e) => handleInputChange('top', e.target.value)}
            min={0}
            max={max}
            className="h-8 text-center text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-[10px]">Right</Label>
          <Input
            type="number"
            value={value.right}
            onChange={(e) => handleInputChange('right', e.target.value)}
            min={0}
            max={max}
            className="h-8 text-center text-xs"
            disabled={isLinked}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-[10px]">Bottom</Label>
          <Input
            type="number"
            value={value.bottom}
            onChange={(e) => handleInputChange('bottom', e.target.value)}
            min={0}
            max={max}
            className="h-8 text-center text-xs"
            disabled={isLinked}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-muted-foreground text-[10px]">Left</Label>
          <Input
            type="number"
            value={value.left}
            onChange={(e) => handleInputChange('left', e.target.value)}
            min={0}
            max={max}
            className="h-8 text-center text-xs"
            disabled={isLinked}
          />
        </div>
      </div>

      {/* Visual Preview */}
      <div className="flex items-center justify-center">
        <div
          className="border-border bg-muted/30 relative h-12 w-16 rounded border border-dashed"
          style={{
            paddingTop: `${Math.min(value.top, 12)}px`,
            paddingRight: `${Math.min(value.right, 12)}px`,
            paddingBottom: `${Math.min(value.bottom, 12)}px`,
            paddingLeft: `${Math.min(value.left, 12)}px`,
          }}
        >
          <div className="bg-primary/30 h-full w-full rounded-sm" />
        </div>
      </div>
    </div>
  );
}
