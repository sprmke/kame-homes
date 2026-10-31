import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildShowcaseBrandPalette } from '@/features/guest/marketing/showcase/lib/showcaseBrandPalette';

import { PaletteSwatchDots } from '@/features/dashboard/page-editor/components/shared/PalettePreviewChip';

import { Input } from '@/components/ui/input';
import { hexToHsv, hsvToHex, normalizePickerHex, type Hsv } from '@/lib/theme/hsvColor';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  fallbackHex: string;
  onChange: (hex: string) => void;
};

function hslSurface(hsl: string): string {
  return `hsl(${hsl})`;
}

function generatedSwatchColors(hex: string): string[] {
  const palette = buildShowcaseBrandPalette(hex);
  return [
    hslSurface(palette.surfaceHslLight),
    hslSurface(palette.surfaceHslDark),
    palette.accentHexLight,
    palette.accentHexDark,
  ];
}

function pointerPosition(event: React.PointerEvent | PointerEvent, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const x = clamp01((event.clientX - rect.left) / rect.width);
  const y = clamp01((event.clientY - rect.top) / rect.height);
  return { x, y };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function ShowcaseCustomPalettePicker({ value, fallbackHex, onChange }: Props) {
  const hex = normalizePickerHex(value, fallbackHex);
  const hsv = useMemo(() => hexToHsv(hex), [hex]);
  const previewColors = useMemo(() => generatedSwatchColors(hex), [hex]);

  const slRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const [hexDraft, setHexDraft] = useState(hex);

  useEffect(() => {
    setHexDraft(hex);
  }, [hex]);

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const emitHsv = useCallback(
    (next: Hsv) => {
      const nextHex = hsvToHex(next.h, next.s, next.v);
      setHexDraft(nextHex);
      onChange(nextHex);
    },
    [onChange]
  );

  const handleSlPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = slRef.current;
      if (!el) return;
      const { x, y } = pointerPosition(event, el);
      emitHsv({ h: hsv.h, s: x * 100, v: (1 - y) * 100 });
    },
    [emitHsv, hsv.h]
  );

  const handleHuePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const el = hueRef.current;
      if (!el) return;
      const { x } = pointerPosition(event, el);
      emitHsv({ h: x * 360, s: hsv.s, v: hsv.v });
    },
    [emitHsv, hsv.s, hsv.v]
  );

  const startDrag = (
    kind: 'sl' | 'hue',
    handler: (event: React.PointerEvent<HTMLDivElement>) => void
  ) => {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      handler(event);

      const move = (moveEvent: PointerEvent) => {
        const current = hsvRef.current;
        if (kind === 'sl' && slRef.current) {
          const { x, y } = pointerPosition(moveEvent, slRef.current);
          emitHsv({ h: current.h, s: x * 100, v: (1 - y) * 100 });
        }
        if (kind === 'hue' && hueRef.current) {
          const { x } = pointerPosition(moveEvent, hueRef.current);
          emitHsv({ h: x * 360, s: current.s, v: current.v });
        }
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  };

  const slX = hsv.s / 100;
  const slY = 1 - hsv.v / 100;
  const hueX = hsv.h / 360;
  const pureHue = hsvToHex(hsv.h, 100, 100);

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-3 shadow-sm">
      <div
        ref={slRef}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={startDrag('sl', handleSlPointer)}
        className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-lg shadow-inner"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`,
        }}
      >
        <span
          className="border-background pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition-[left,top] duration-75 ease-out"
          style={{
            left: `${slX * 100}%`,
            top: `${slY * 100}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        tabIndex={0}
        onPointerDown={startDrag('hue', handleHuePointer)}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full shadow-inner"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      >
        <span
          className="border-background pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition-[left] duration-75 ease-out"
          style={{
            left: `${hueX * 100}%`,
            backgroundColor: pureHue,
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div
          className="border-border size-11 shrink-0 rounded-lg border shadow-sm transition-colors duration-150"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <Input
          value={hexDraft}
          onChange={(event) => {
            const next = event.target.value;
            setHexDraft(next);
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setHexDraft(hex)}
          className="min-h-11 flex-1 font-mono text-sm"
          spellCheck={false}
          aria-label="Hex color"
        />
      </div>

      <div
        className={cn(
          'border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
          'transition-colors duration-200'
        )}
      >
        <PaletteSwatchDots colors={previewColors} size="md" />
        <span
          className="size-8 shrink-0 rounded-full shadow-sm transition-colors duration-150"
          style={{ backgroundColor: previewColors[2] }}
          aria-hidden
        />
      </div>
    </div>
  );
}
