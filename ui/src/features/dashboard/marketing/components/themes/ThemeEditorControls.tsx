import { useEffect, useId, useMemo, useState } from 'react';

import { Check } from 'lucide-react';

import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { normalizeThemeHex } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import {
  findMarketingFontPairing,
  MARKETING_FONT_PAIRINGS,
  MARKETING_THEME_FONT_FAMILIES,
  type MarketingThemeFonts,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import { PROPERTY_COLORS_THEME_NAME } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Native color well + hex field. The OS picker is the most touch-friendly option on phones. */
export function ThemeColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const hex = normalizeThemeHex(draft);
    if (hex) onChange(hex);
    else setDraft(value);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="border-border relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">Pick {label.toLowerCase()} color</span>
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
          className="font-mono uppercase"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}

type PaletteOption = { key: string; label: string; palette: MarketingThemeTokens['palette'] };

/** One tap to try another palette; fonts and shape stay as they are. */
export function ThemePalettePicker({
  current,
  onPick,
}: {
  current: MarketingThemeTokens;
  onPick: (palette: MarketingThemeTokens['palette']) => void;
}) {
  const { library } = useMarketingTheme();
  const options = useMemo<PaletteOption[]>(() => {
    const propertyColors = library.byKey.get('property-colors');
    const list: PaletteOption[] = propertyColors
      ? [
          {
            key: 'property-colors',
            label: PROPERTY_COLORS_THEME_NAME,
            palette: propertyColors.tokens.palette,
          },
        ]
      : [];
    return [
      ...list,
      ...library.starters.map((entry) => ({
        key: entry.key,
        label: entry.name,
        palette: entry.tokens.palette,
      })),
    ];
  }, [library]);

  const isSame = (palette: MarketingThemeTokens['palette']) =>
    (Object.keys(palette) as Array<keyof typeof palette>).every(
      (role) => palette[role].toLowerCase() === current.palette[role].toLowerCase()
    );

  return (
    <div
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
      role="listbox"
      aria-label="Palettes"
    >
      {options.map((option) => {
        const selected = isSame(option.palette);
        return (
          <button
            key={option.key}
            type="button"
            role="option"
            aria-selected={selected}
            title={option.label}
            onClick={() => onPick(option.palette)}
            className={cn(
              'border-border flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium',
              selected ? 'border-primary ring-primary/30 ring-2' : 'hover:bg-muted/60'
            )}
          >
            <span className="flex -space-x-1" aria-hidden>
              {[option.palette.primary, option.palette.secondary, option.palette.accent].map(
                (color, index) => (
                  <span
                    key={index}
                    className="ring-card size-4 rounded-full ring-2"
                    style={{ backgroundColor: color }}
                  />
                )
              )}
            </span>
            <span className="max-w-[7.5rem] truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeFontPairingPicker({
  value,
  onChange,
}: {
  value: MarketingThemeFonts;
  onChange: (fonts: MarketingThemeFonts) => void;
}) {
  useEffect(() => {
    void loadMarketingFonts(
      MARKETING_FONT_PAIRINGS.flatMap((p) => [p.fonts.display, p.fonts.body])
    );
  }, []);
  const selectedId = findMarketingFontPairing(value)?.id ?? null;

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      role="radiogroup"
      aria-label="Font pairing"
    >
      {MARKETING_FONT_PAIRINGS.map((pairing) => {
        const selected = pairing.id === selectedId;
        return (
          <button
            key={pairing.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(pairing.fonts)}
            className={cn(
              'border-border relative flex min-h-[72px] flex-col items-start justify-between rounded-xl border p-2.5 text-left',
              selected ? 'border-primary ring-primary/30 ring-2' : 'hover:bg-muted/60'
            )}
          >
            <span
              className="text-xl leading-none"
              style={{ fontFamily: `"${pairing.fonts.display}", serif` }}
            >
              Aa
            </span>
            <span
              className="text-muted-foreground w-full truncate text-[11px]"
              style={{ fontFamily: `"${pairing.fonts.body}", sans-serif` }}
            >
              {pairing.label}
            </span>
            {selected ? (
              <Check className="text-primary absolute right-2 top-2 size-3.5" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeFontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (family: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MARKETING_THEME_FONT_FAMILIES.map((family) => (
            <SelectItem key={family} value={family}>
              <span style={{ fontFamily: `"${family}"` }}>{family}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ThemeOptionGrid<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-sm font-medium leading-none">
        {label}
      </p>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-labelledby={id}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              'border-border min-h-[44px] rounded-lg border px-1 text-xs font-medium',
              option.value === value
                ? 'border-primary bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted/60'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
