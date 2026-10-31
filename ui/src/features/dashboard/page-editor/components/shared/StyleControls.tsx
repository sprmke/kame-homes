import type { ShowcaseMediaPalette } from '@/features/guest/marketing/showcase/lib/showcaseMediaPalette';
import { resolvePaletteModeSwatchColors } from '@/features/guest/marketing/showcase/lib/showcasePalettePreview';
import {
  getShowcasePresetPalette,
  isShowcasePresetPaletteId,
  SHOWCASE_PRESET_PALETTE_LIST,
} from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';
import type { ShowcasePaletteMode } from '@/features/guest/marketing/showcase/types/showcase';

import {
  PaletteOptionLabel,
  PaletteSwatchDots,
} from '@/features/dashboard/page-editor/components/shared/PalettePreviewChip';
import { ShowcaseCustomPalettePicker } from '@/features/dashboard/page-editor/components/shared/ShowcaseCustomPalettePicker';

import { FieldLabel } from '@/components/forms/FieldLabel';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_ORG_BRAND_COLOR, resolveOrgBrandHex } from '@/lib/theme/brandColor';
import { cn } from '@/lib/utils';

const CUSTOM_PALETTE_PLACEHOLDER = ['#f97316', '#eab308', '#22c55e', '#6366f1', '#ec4899'] as const;

const STYLE_FIELD_HELP = {
  paletteMode: 'Colors for the page background and accents.',
  overlay: 'How dark the fade is over the hero photo.',
  displayFont: 'Font used for big titles.',
  scale: 'Overall text size on the page.',
  motionIntensity: 'How strong animations feel.',
  parallax: 'Layers move at different speeds while scrolling.',
  canvas: 'Subtle animated texture behind the page.',
} as const;

function paletteModeLabel(mode: ShowcasePaletteMode): string {
  if (mode === 'default') return 'Default';
  if (mode === 'brand') return 'Brand';
  if (mode === 'media') return 'From photos';
  if (mode === 'custom') return 'Custom';
  if (isShowcasePresetPaletteId(mode)) return getShowcasePresetPalette(mode).label;
  return mode;
}

export function ColumnCountControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label="Columns" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onChange(count)}
            className={cn(
              'min-h-11 min-w-11 rounded-md border text-sm',
              value === count ? 'border-primary bg-primary/10' : 'border-border'
            )}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PaletteControl({
  mode,
  customPaletteBase,
  overlay,
  propertyBrandColor,
  mediaPalette,
  onModeChange,
  onCustomPaletteBaseChange,
  onOverlayChange,
  showOverlay = true,
}: {
  mode: ShowcasePaletteMode;
  customPaletteBase?: string | null;
  overlay: 'none' | 'soft' | 'strong';
  propertyBrandColor?: string | null;
  mediaPalette?: ShowcaseMediaPalette | null;
  onModeChange: (mode: ShowcasePaletteMode) => void;
  onCustomPaletteBaseChange?: (color: string) => void;
  onOverlayChange: (overlay: 'none' | 'soft' | 'strong') => void;
  showOverlay?: boolean;
}) {
  const fallbackHex = resolveOrgBrandHex(propertyBrandColor ?? DEFAULT_ORG_BRAND_COLOR);
  const selectedSwatch =
    mode === 'custom' && !customPaletteBase
      ? [...CUSTOM_PALETTE_PLACEHOLDER]
      : resolvePaletteModeSwatchColors(
          mode,
          propertyBrandColor,
          mediaPalette ?? null,
          customPaletteBase
        );
  const renderPaletteOption = (paletteMode: ShowcasePaletteMode, label: string) => (
    <PaletteOptionLabel
      colors={resolvePaletteModeSwatchColors(
        paletteMode,
        propertyBrandColor,
        mediaPalette ?? null,
        paletteMode === 'custom' ? customPaletteBase : undefined
      )}
      label={label}
    />
  );

  const handleModeChange = (value: string) => {
    const next = value as ShowcasePaletteMode;
    if (next === 'custom') {
      onModeChange('custom');
      if (!customPaletteBase?.trim() && onCustomPaletteBaseChange) {
        onCustomPaletteBaseChange(fallbackHex);
      }
      return;
    }
    onModeChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <FieldLabel label="Palette mode" help={STYLE_FIELD_HELP.paletteMode} />
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="min-h-11">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <PaletteSwatchDots colors={selectedSwatch} size="sm" />
              <SelectValue>{paletteModeLabel(mode)}</SelectValue>
            </span>
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectGroup>
              <SelectLabel>Template</SelectLabel>
              <SelectItem value="default">{renderPaletteOption('default', 'Default')}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Your property</SelectLabel>
              <SelectItem value="brand">{renderPaletteOption('brand', 'Brand')}</SelectItem>
              <SelectItem value="media">{renderPaletteOption('media', 'From photos')}</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Curated</SelectLabel>
              {SHOWCASE_PRESET_PALETTE_LIST.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {renderPaletteOption(preset.id, preset.label)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value="custom">
              <span className="flex min-w-0 items-center gap-2.5">
                {customPaletteBase ? (
                  <PaletteSwatchDots
                    colors={resolvePaletteModeSwatchColors(
                      'custom',
                      propertyBrandColor,
                      mediaPalette ?? null,
                      customPaletteBase
                    )}
                    size="sm"
                  />
                ) : (
                  <span
                    className="border-border inline-flex size-4 shrink-0 rounded-full border shadow-sm"
                    style={{
                      background:
                        'conic-gradient(from 200deg, #FB923C, #FBBF24, #34D399, #6366F1, #E879F9, #FB923C)',
                    }}
                    aria-hidden
                  />
                )}
                <span className="truncate">Custom</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'custom' && onCustomPaletteBaseChange ? (
        <ShowcaseCustomPalettePicker
          value={customPaletteBase ?? fallbackHex}
          fallbackHex={fallbackHex}
          onChange={onCustomPaletteBaseChange}
        />
      ) : null}
      {showOverlay ? (
        <div className="space-y-1.5">
          <FieldLabel label="Overlay" help={STYLE_FIELD_HELP.overlay} />
          <Select
            value={overlay}
            onValueChange={(value) => onOverlayChange(value as typeof overlay)}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200]">
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="soft">Soft</SelectItem>
              <SelectItem value="strong">Strong</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}

type DisplayFont = 'jakarta' | 'outfit' | 'instrument' | 'cormorant' | 'fraunces';
type TypeScale = 'sm' | 'md' | 'lg';

export function TypographyControl({
  displayFont,
  scale,
  onDisplayFontChange,
  onScaleChange,
  hideDisplayFont = false,
}: {
  displayFont: DisplayFont;
  scale: TypeScale;
  onDisplayFontChange: (font: DisplayFont) => void;
  onScaleChange: (scale: TypeScale) => void;
  /** Monolith locks display face in the template — scale only. */
  hideDisplayFont?: boolean;
}) {
  return (
    <div className="space-y-3">
      {!hideDisplayFont ? (
        <div className="space-y-1.5">
          <FieldLabel label="Display font" help={STYLE_FIELD_HELP.displayFont} />
          <Select
            value={displayFont}
            onValueChange={(value) => onDisplayFontChange(value as DisplayFont)}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200]">
              <SelectItem value="jakarta">Plus Jakarta</SelectItem>
              <SelectItem value="outfit">Outfit</SelectItem>
              <SelectItem value="instrument">Instrument</SelectItem>
              <SelectItem value="cormorant">Cormorant</SelectItem>
              <SelectItem value="fraunces">Fraunces</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <FieldLabel label="Scale" help={STYLE_FIELD_HELP.scale} />
        <Select value={scale} onValueChange={(value) => onScaleChange(value as TypeScale)}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type MotionIntensity = 'subtle' | 'standard' | 'bold';

export function MotionControl({
  intensity,
  parallax,
  canvas,
  onIntensityChange,
  onParallaxChange,
  onCanvasChange,
  showParallax = true,
  showCanvas = true,
}: {
  intensity: MotionIntensity;
  parallax: boolean;
  canvas: boolean;
  onIntensityChange: (intensity: MotionIntensity) => void;
  onParallaxChange: (parallax: boolean) => void;
  onCanvasChange: (canvas: boolean) => void;
  showParallax?: boolean;
  showCanvas?: boolean;
}) {
  const parallaxAvailable = showParallax && intensity !== 'subtle';

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <FieldLabel label="Motion intensity" help={STYLE_FIELD_HELP.motionIntensity} />
        <Select
          value={intensity}
          onValueChange={(value) => onIntensityChange(value as MotionIntensity)}
        >
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectItem value="subtle">Subtle</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {parallaxAvailable ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <FieldLabel
            htmlFor="showcase-parallax"
            label="Parallax"
            help={STYLE_FIELD_HELP.parallax}
          />
          <Switch id="showcase-parallax" checked={parallax} onCheckedChange={onParallaxChange} />
        </div>
      ) : null}
      {showCanvas ? (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <FieldLabel
            htmlFor="showcase-canvas"
            label="Canvas background"
            help={STYLE_FIELD_HELP.canvas}
          />
          <Switch id="showcase-canvas" checked={canvas} onCheckedChange={onCanvasChange} />
        </div>
      ) : null}
    </div>
  );
}
