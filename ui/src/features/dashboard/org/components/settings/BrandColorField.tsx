import { useEffect, useMemo, useState } from 'react';

import { Check, ImageIcon, Loader2, Sparkles } from 'lucide-react';

import { OrgSettingsField } from '@/features/dashboard/org/components/org-settings/OrgSettingsFields';
import { SettingsField } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';
import { BRAND_COLOR_PRESETS } from '@/lib/theme/brandColorPresets';
import { extractBrandAccentFromPhotos } from '@/lib/theme/photoBrandColor';
import { cn } from '@/lib/utils';

const RAINBOW_SWATCH_BACKGROUND =
  'conic-gradient(from 180deg, #FB923C, #FBBF24, #A3E635, #34D399, #38BDF8, #6366F1, #E879F9, #FB7185, #FB923C)';

const PHOTO_SWATCH_IDLE_BACKGROUND =
  'conic-gradient(from 200deg, #E8D5B7 0deg, #C9A66B 72deg, #D4B896 144deg, #F0E4CE 216deg, #B8895A 288deg, #E8D5B7 360deg)';

type Props = {
  id: string;
  value: string;
  resolvedColor: string;
  disabled?: boolean;
  error?: string | null;
  help?: string;
  layout?: 'property' | 'org';
  /** Value applied when Reset is clicked — org uses default hex; property clears override. */
  resetValue?: string;
  onChange: (value: string) => void;
  /**
   * When true, omit the built-in "Brand color" label (parent chrome already titles the block).
   * Property Settings / Org Settings keep the default label.
   */
  hideLabel?: boolean;
  /** Property-only: gallery image URLs for on-demand accent extraction. */
  photoUrls?: string[];
};

function PhotoBrandColorSwatch({
  disabled,
  photoUrls,
  pickerValue,
  extractedHex,
  onExtractedHexChange,
  onChange,
}: {
  disabled?: boolean;
  photoUrls: string[];
  pickerValue: string;
  extractedHex: string | null;
  onExtractedHexChange: (hex: string | null) => void;
  onChange: (value: string) => void;
}) {
  const hasPhotos = photoUrls.length > 0;
  const photoSignature = useMemo(() => photoUrls.join('|'), [photoUrls]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onExtractedHexChange(null);
  }, [photoSignature, onExtractedHexChange]);

  const isSelected =
    Boolean(extractedHex) && pickerValue.toLowerCase() === extractedHex!.toLowerCase();

  async function handleExtract() {
    if (!hasPhotos || disabled || loading) return;
    setLoading(true);
    try {
      const hex = await extractBrandAccentFromPhotos(photoUrls);
      if (hex) {
        onExtractedHexChange(hex);
        onChange(hex);
      }
    } finally {
      setLoading(false);
    }
  }

  const inactive = disabled || !hasPhotos;

  const tooltip = hasPhotos
    ? 'Extract brand color from your uploaded photos'
    : 'Upload property photos to enable';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex rounded-full">
          <button
            type="button"
            disabled={disabled || loading}
            aria-disabled={inactive}
            onClick={() => void handleExtract()}
            className={cn(
              'relative flex size-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition-transform',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              !hasPhotos && 'border-muted-foreground/30 bg-muted/35 border-dashed',
              hasPhotos && !isSelected && 'border-border hover:scale-105 active:scale-95',
              inactive && 'cursor-not-allowed opacity-50',
              isSelected && 'ring-foreground ring-offset-background ring-2 ring-offset-2'
            )}
            style={
              isSelected && extractedHex
                ? { backgroundColor: extractedHex }
                : hasPhotos
                  ? { background: PHOTO_SWATCH_IDLE_BACKGROUND }
                  : undefined
            }
            aria-label={tooltip}
            aria-pressed={isSelected}
          >
            {loading ? (
              <Loader2 className="text-foreground size-4 animate-spin" aria-hidden />
            ) : isSelected ? (
              <Check className="size-4 text-white drop-shadow-sm" aria-hidden />
            ) : hasPhotos ? (
              <Sparkles className="size-4 text-white drop-shadow-sm" aria-hidden />
            ) : (
              <ImageIcon className="text-muted-foreground/55 size-4" aria-hidden />
            )}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function BrandColorControls({
  id,
  value,
  resolvedColor,
  disabled,
  resetValue = DEFAULT_ORG_BRAND_COLOR,
  onChange,
  photoUrls,
}: Pick<
  Props,
  'id' | 'value' | 'resolvedColor' | 'disabled' | 'resetValue' | 'onChange' | 'photoUrls'
>) {
  const pickerValue = value.trim() || resolvedColor;
  const isAtResetValue = value.trim().toLowerCase() === resetValue.trim().toLowerCase();
  const [extractedHex, setExtractedHex] = useState<string | null>(null);
  const [choseCustom, setChoseCustom] = useState(false);

  const matchesPreset = BRAND_COLOR_PRESETS.some(
    (preset) => preset.hex.toLowerCase() === pickerValue.toLowerCase()
  );
  const matchesPhoto =
    Boolean(extractedHex) && pickerValue.toLowerCase() === extractedHex!.toLowerCase();
  /** Rainbow swatch only when the host used the color picker — not photo extract / presets. */
  const isCustomSelected = choseCustom && !matchesPreset && !matchesPhoto;

  const applyPresetOrReset = (next: string) => {
    setChoseCustom(false);
    onChange(next);
  };

  const applyPhotoExtract = (next: string) => {
    setChoseCustom(false);
    onChange(next);
  };

  const applyCustomPicker = (next: string) => {
    setChoseCustom(true);
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {BRAND_COLOR_PRESETS.map((preset) => {
        const isSelected = pickerValue.toLowerCase() === preset.hex.toLowerCase();
        return (
          <button
            key={preset.hex}
            type="button"
            disabled={disabled}
            onClick={() => applyPresetOrReset(preset.hex)}
            className={cn(
              'border-border flex size-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition-transform',
              'disabled:pointer-events-none disabled:opacity-50',
              isSelected && 'ring-foreground ring-offset-background ring-2 ring-offset-2'
            )}
            style={{ backgroundColor: preset.hex }}
            aria-label={`Use ${preset.label} brand color`}
            aria-pressed={isSelected}
          >
            {isSelected && <Check className="size-4 text-white drop-shadow-sm" aria-hidden />}
          </button>
        );
      })}
      {photoUrls ? (
        <PhotoBrandColorSwatch
          disabled={disabled}
          photoUrls={photoUrls}
          pickerValue={pickerValue}
          extractedHex={extractedHex}
          onExtractedHexChange={setExtractedHex}
          onChange={applyPhotoExtract}
        />
      ) : null}
      <label
        htmlFor={`${id}-picker`}
        className={cn(
          'border-border relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border shadow-sm',
          disabled && 'pointer-events-none opacity-50',
          isCustomSelected && 'ring-foreground ring-offset-background ring-2 ring-offset-2'
        )}
        style={{ background: RAINBOW_SWATCH_BACKGROUND }}
      >
        {isCustomSelected && <Check className="size-4 text-white drop-shadow-sm" aria-hidden />}
        <input
          id={`${id}-picker`}
          type="color"
          value={pickerValue}
          onChange={(event) => applyCustomPicker(event.target.value)}
          disabled={disabled}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-label="Pick a custom brand color"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isAtResetValue}
        className="settings-action"
        onClick={() => applyPresetOrReset(resetValue)}
        aria-label="Reset brand color to default"
      >
        Reset
      </Button>
    </div>
  );
}

export function BrandColorField({
  id,
  value,
  resolvedColor,
  disabled,
  error,
  help,
  layout = 'property',
  resetValue,
  onChange,
  hideLabel = false,
  photoUrls,
}: Props) {
  const effectiveResetValue =
    resetValue ?? (layout === 'property' ? resolvedColor : DEFAULT_ORG_BRAND_COLOR);
  const propertyPhotoUrls = layout === 'property' ? photoUrls : undefined;

  const controls = (
    <BrandColorControls
      id={id}
      value={value}
      resolvedColor={resolvedColor}
      disabled={disabled}
      resetValue={effectiveResetValue}
      onChange={onChange}
      photoUrls={propertyPhotoUrls}
    />
  );

  if (hideLabel) {
    return (
      <div className="space-y-2">
        {controls}
        {error ? (
          <p id={`${id}-error`} className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (layout === 'org') {
    return (
      <OrgSettingsField id={id} label="Brand color" help={help} error={error}>
        {controls}
      </OrgSettingsField>
    );
  }

  return (
    <SettingsField id={id} label="Brand color" error={error} help={help}>
      {controls}
    </SettingsField>
  );
}
