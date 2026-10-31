import { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  showAlpha?: boolean;
}

const PRESET_COLORS = [
  '#000000',
  '#ffffff',
  '#f3f4f6',
  '#e5e7eb',
  '#d1d5db',
  '#9ca3af',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#059669',
];

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Validate hex color
    if (
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(newValue) ||
      /^#([0-9A-Fa-f]{4}){1,2}$/.test(newValue) ||
      /^rgba?\(/.test(newValue)
    ) {
      onChange(newValue);
    }
  };

  const handleInputBlur = () => {
    // If invalid, reset to current value
    if (!isValidColor(inputValue)) {
      setInputValue(value);
    }
  };

  const isValidColor = (color: string) => {
    return (
      /^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ||
      /^#([0-9A-Fa-f]{4}){1,2}$/.test(color) ||
      /^rgba?\(/.test(color) ||
      /^transparent$/.test(color)
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <Label className="text-muted-foreground mb-1.5 block text-xs">{label}</Label>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="border-input hover:bg-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors"
          style={{ backgroundColor: value }}
        >
          {value === 'transparent' && (
            <div className="h-full w-full rounded-md bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" />
          )}
        </button>

        <Input
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="h-9 flex-1 font-mono text-xs"
          placeholder="#000000"
        />
      </div>

      {isOpen && (
        <div className="border-border bg-popover absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border p-3 shadow-lg">
          {/* Color input */}
          <div className="mb-3">
            <input
              type="color"
              value={value.startsWith('#') ? value.substring(0, 7) : '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 w-full cursor-pointer rounded border-0"
            />
          </div>

          {/* Preset colors */}
          <div className="grid grid-cols-8 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${
                  value === color ? 'ring-primary ring-2 ring-offset-1' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Transparent option */}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onChange('transparent');
                setIsOpen(false);
              }}
              className="flex-1 text-xs"
            >
              Transparent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="flex-1 text-xs"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
