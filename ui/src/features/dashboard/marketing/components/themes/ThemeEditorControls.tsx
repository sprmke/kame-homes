import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { Check, Plus } from 'lucide-react';

import { GENERATION_LOOKS } from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import {
  resolveMarketingTheme,
  type MarketingThemeBackground,
  type MarketingThemeCorners,
  type MarketingThemePhotoLook,
  type MarketingThemeTokens,
} from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { normalizeThemeHex } from '@/features/dashboard/marketing/lib/theme/marketingThemeColor';
import { themeSurfaceBackground } from '@/features/dashboard/marketing/lib/theme/marketingThemeCss';
import {
  findMarketingFontPairing,
  MARKETING_FONT_PAIRINGS,
  MARKETING_THEME_FONT_FAMILIES,
  type MarketingThemeFonts,
} from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import {
  colorShades,
  samePalette,
  type PaletteSuggestion,
  type ThemePalette,
  type ThemePaletteRole,
} from '@/features/dashboard/marketing/lib/theme/themePaletteSuggestions';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const selectedRing = 'border-primary ring-primary/30 ring-2';

/** Whole palettes in a wrapping grid: one tap restyles every color at once. */
export function ThemePaletteGrid({
  current,
  options,
  onPick,
}: {
  current: ThemePalette;
  options: readonly PaletteSuggestion[];
  onPick: (palette: ThemePalette) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Palettes">
      {options.map((option) => {
        const selected = samePalette(option.palette, current);
        const { primary, secondary, accent, surface, ink } = option.palette;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onPick(option.palette)}
            className={cn(
              'border-border relative flex min-h-[44px] flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-colors',
              selected ? selectedRing : 'hover:bg-muted/60'
            )}
          >
            <span className="flex h-7 overflow-hidden rounded-lg" aria-hidden>
              {[primary, accent, secondary, surface].map((color, index) => (
                <span key={index} className="flex-1" style={{ backgroundColor: color }} />
              ))}
              <span className="w-2" style={{ backgroundColor: ink }} />
            </span>
            <span className="text-muted-foreground truncate px-0.5 text-[11px] leading-tight">
              {option.label}
            </span>
            {selected ? (
              <span className="bg-primary-strong text-primary-foreground absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full">
                <Check className="size-3" aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const THEME_COLOR_ROLE_LABELS: Record<ThemePaletteRole, string> = {
  primary: 'Main',
  accent: 'Highlight',
  secondary: 'Soft tone',
  surface: 'Background',
  ink: 'Text',
};

const ROLE_ORDER: ThemePaletteRole[] = ['primary', 'accent', 'secondary', 'surface', 'ink'];

function Swatch({
  color,
  selected,
  label,
  onClick,
}: {
  color: string;
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className="relative flex size-11 items-center justify-center rounded-full"
    >
      <span
        className={cn(
          'border-border/70 size-8 rounded-full border',
          selected && 'ring-primary ring-offset-card ring-2 ring-offset-2'
        )}
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

/**
 * The five theme colors as swatches. Tapping one opens its shades and a few
 * suggestions right below; "Any color" opens the device color picker. No color
 * codes are shown anywhere.
 */
export function ThemeColorRoles({
  palette,
  suggestions,
  onChange,
}: {
  palette: ThemePalette;
  suggestions: (role: ThemePaletteRole) => string[];
  onChange: (role: ThemePaletteRole, color: string) => void;
}) {
  const [role, setRole] = useState<ThemePaletteRole | null>(null);
  const pickerId = useId();
  const current = role ? palette[role].toLowerCase() : null;

  // Shades follow the color the role had when it was opened, so picking a shade
  // doesn't shift the row under the finger.
  const [shadeBase, setShadeBase] = useState<string | null>(null);
  const shades = useMemo(() => (shadeBase ? colorShades(shadeBase) : []), [shadeBase]);
  const others = useMemo(() => {
    if (!role) return [];
    const taken = new Set(shades);
    return suggestions(role).filter((color) => !taken.has(color));
  }, [role, shades, suggestions]);

  const toggleRole = (next: ThemePaletteRole) => {
    if (role === next) {
      setRole(null);
      return;
    }
    setRole(next);
    setShadeBase(palette[next].toLowerCase());
  };

  const pick = (color: string) => {
    const hex = normalizeThemeHex(color);
    if (role && hex) onChange(role, hex);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1">
        {ROLE_ORDER.map((key) => {
          const selected = role === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              aria-label={`${THEME_COLOR_ROLE_LABELS[key]} color`}
              onClick={() => toggleRole(key)}
              className={cn(
                'flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-0.5 py-2 transition-colors',
                selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/60 border-transparent'
              )}
            >
              <span
                className="border-border/70 size-8 rounded-full border shadow-sm"
                style={{ backgroundColor: palette[key] }}
                aria-hidden
              />
              <span className="text-muted-foreground w-full text-center text-[10px] leading-none sm:text-[11px]">
                {THEME_COLOR_ROLE_LABELS[key]}
              </span>
            </button>
          );
        })}
      </div>

      {role && current ? (
        <div className="border-border bg-muted/30 space-y-1.5 rounded-xl border p-2.5">
          <p className="text-muted-foreground px-1 text-xs">Lighter or darker</p>
          <div
            className="flex flex-wrap gap-0.5"
            role="radiogroup"
            aria-label={`${THEME_COLOR_ROLE_LABELS[role]} shades`}
          >
            {shades.map((color, index) => (
              <Swatch
                key={`shade-${index}`}
                color={color}
                selected={color === current}
                label={index === 2 ? 'Original' : index < 2 ? 'Lighter' : 'Darker'}
                onClick={() => pick(color)}
              />
            ))}
          </div>
          <p className="text-muted-foreground px-1 pt-1 text-xs">Other colors</p>
          <div
            className="flex flex-wrap gap-0.5"
            role="radiogroup"
            aria-label={`Other ${THEME_COLOR_ROLE_LABELS[role].toLowerCase()} colors`}
          >
            {others.map((color) => (
              <Swatch
                key={color}
                color={color}
                selected={color === current}
                label="Suggested color"
                onClick={() => pick(color)}
              />
            ))}
            <label
              htmlFor={pickerId}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
              title="Any color"
            >
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{
                  background:
                    'conic-gradient(#f87171, #fbbf24, #a3e635, #34d399, #38bdf8, #818cf8, #e879f9, #f87171)',
                }}
                aria-hidden
              >
                <span className="bg-card/90 flex size-5 items-center justify-center rounded-full">
                  <Plus className="size-3" />
                </span>
              </span>
              <span className="sr-only">Any color</span>
              <input
                id={pickerId}
                type="color"
                value={current}
                onChange={(event) => pick(event.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      ) : null}
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
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Font pairing">
      {MARKETING_FONT_PAIRINGS.map((pairing) => {
        const selected = pairing.id === selectedId;
        return (
          <button
            key={pairing.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={pairing.label}
            onClick={() => onChange(pairing.fonts)}
            className={cn(
              'border-border relative flex min-h-[64px] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2 text-left',
              selected ? selectedRing : 'hover:bg-muted/60'
            )}
          >
            <span
              className="w-full truncate pr-4 text-lg leading-none"
              style={{ fontFamily: `"${pairing.fonts.display}", serif` }}
            >
              {pairing.label}
            </span>
            <span
              className="text-muted-foreground w-full truncate text-xs"
              style={{ fontFamily: `"${pairing.fonts.body}", sans-serif` }}
            >
              Book your stay
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

function VisualOption({
  label,
  selected,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'border-border flex min-w-0 flex-col items-stretch gap-1.5 rounded-xl border p-1.5 text-xs font-medium',
        selected ? cn(selectedRing, 'text-foreground') : 'text-muted-foreground hover:bg-muted/60'
      )}
    >
      {children}
      <span className="truncate text-center leading-tight">{label}</span>
    </button>
  );
}

const BACKGROUND_OPTIONS: Array<{ value: MarketingThemeBackground; label: string }> = [
  { value: 'solid', label: 'Plain' },
  { value: 'soft-gradient', label: 'Gradient' },
  { value: 'pattern', label: 'Dots' },
  { value: 'photo-wash', label: 'Photo' },
];

export function ThemeBackgroundPicker({
  tokens,
  photoUrl,
  onChange,
}: {
  tokens: MarketingThemeTokens;
  photoUrl?: string;
  onChange: (background: MarketingThemeBackground) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Background">
      {BACKGROUND_OPTIONS.map((option) => {
        const theme = resolveMarketingTheme({ ...tokens, background: option.value });
        const photo = option.value === 'photo-wash' ? photoUrl : undefined;
        return (
          <VisualOption
            key={option.value}
            label={option.label}
            selected={tokens.background === option.value}
            onClick={() => onChange(option.value)}
          >
            <span
              className="border-border/60 relative block aspect-[4/3] overflow-hidden rounded-lg border"
              style={{ background: themeSurfaceBackground(theme) }}
              aria-hidden
            >
              {photo ? (
                <>
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    loading="lazy"
                  />
                  <span
                    className="absolute inset-0"
                    style={{ backgroundColor: theme.surface, opacity: 0.55 }}
                  />
                </>
              ) : null}
            </span>
          </VisualOption>
        );
      })}
    </div>
  );
}

const CORNER_OPTIONS: Array<{ value: MarketingThemeCorners; label: string; radius: string }> = [
  { value: 'sharp', label: 'Sharp', radius: '2px' },
  { value: 'soft', label: 'Soft', radius: '8px' },
  { value: 'round', label: 'Round', radius: '999px' },
];

export function ThemeCornerPicker({
  value,
  color,
  onChange,
}: {
  value: MarketingThemeCorners;
  color: string;
  onChange: (corners: MarketingThemeCorners) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Corners">
      {CORNER_OPTIONS.map((option) => (
        <VisualOption
          key={option.value}
          label={option.label}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span className="flex h-9 items-center justify-center" aria-hidden>
            <span
              className="h-6 w-12"
              style={{ backgroundColor: color, borderRadius: option.radius }}
            />
          </span>
        </VisualOption>
      ))}
    </div>
  );
}

const NO_PHOTO_LOOK = 'none';

/** Default light and mood for AI Photo / Video made in this theme. */
export function ThemePhotoLookSelect({
  value,
  onChange,
}: {
  value: MarketingThemePhotoLook | null | undefined;
  onChange: (look: MarketingThemePhotoLook | null) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Photo mood</Label>
      <Select
        value={value ?? NO_PHOTO_LOOK}
        onValueChange={(next) =>
          onChange(next === NO_PHOTO_LOOK ? null : (next as MarketingThemePhotoLook))
        }
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PHOTO_LOOK}>None</SelectItem>
          {GENERATION_LOOKS.map((look) => (
            <SelectItem key={look.id} value={look.id}>
              {look.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
