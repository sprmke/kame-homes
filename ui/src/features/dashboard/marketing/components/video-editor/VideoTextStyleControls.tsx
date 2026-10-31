import { AlignCenter, AlignLeft, AlignRight, Bold } from 'lucide-react';

import { ColorPicker } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/ColorPicker';
import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import {
  buildTypographyFromPreset,
  resolveLayerTypography,
  VIDEO_FONT_FAMILIES,
  VIDEO_TEXT_PRESETS,
  type VideoTextPresetId,
} from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import type {
  VideoLayerTypography,
  VideoSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Props = {
  layer: VideoSceneLayer;
  templateTypography: VideoTypographyContext;
  onChange: (patch: Partial<VideoSceneLayer>) => void;
};

export function VideoTextStyleControls({ layer, templateTypography, onChange }: Props) {
  const isCta = layer.kind === 'cta';
  const typography = resolveLayerTypography(layer, templateTypography);
  const activePreset = detectActivePreset(layer);

  const patchTypography = (patch: Partial<VideoLayerTypography>) => {
    onChange({
      typography: { ...resolveLayerTypography(layer, templateTypography), ...patch },
    });
  };

  const applyPreset = (presetId: VideoTextPresetId) => {
    const preset = VIDEO_TEXT_PRESETS[presetId];
    onChange({
      textStyle: preset.textStyle,
      typography: buildTypographyFromPreset(presetId, templateTypography),
    });
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    onChange({
      position: { ...layer.position, align },
    });
  };

  const toggleBold = () => {
    patchTypography({ fontWeight: typography.fontWeight >= 700 ? 500 : 800 });
  };

  const toggleOutline = () => {
    const on = (typography.strokeWidth ?? 0) > 0;
    patchTypography({
      strokeWidth: on ? 0 : 2,
      strokeColor: on ? null : '#ffffff',
    });
  };

  const presetIds: VideoTextPresetId[] = isCta
    ? ['cta']
    : ['title', 'subtitle', 'promo', 'body', 'label'];

  return (
    <div className="space-y-3">
      <textarea
        value={layer.text ?? ''}
        onChange={(event) => onChange({ text: event.target.value })}
        rows={2}
        aria-label="Text content"
        className="border-input bg-card placeholder:text-muted-foreground field-focus flex min-h-[72px] w-full resize-none rounded-md border px-3 py-2 text-sm"
      />

      {!isCta ? (
        <div className="flex flex-wrap gap-1.5">
          {presetIds.map((presetId) => (
            <button
              key={presetId}
              type="button"
              onClick={() => applyPreset(presetId)}
              className={cn(
                'border-border bg-background hover:bg-muted min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors',
                activePreset === presetId && 'border-primary bg-primary/10 text-primary'
              )}
            >
              {VIDEO_TEXT_PRESETS[presetId].label}
            </button>
          ))}
        </div>
      ) : null}

      <Select
        value={typography.fontFamily}
        onValueChange={(value) => patchTypography({ fontFamily: value })}
      >
        <SelectTrigger className="h-10 min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[min(60vh,280px)]">
          {VIDEO_FONT_FAMILIES.map((font) => (
            <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
              {font.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NumberSlider
        label="Size"
        value={typography.fontSize}
        onChange={(value) => patchTypography({ fontSize: value })}
        min={18}
        max={120}
        step={1}
      />

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <ColorPicker
          label={isCta ? 'Text' : 'Color'}
          value={typography.color}
          onChange={(value) => patchTypography({ color: value })}
        />
        {isCta ? (
          <ColorPicker
            label="Fill"
            value={typography.backgroundColor ?? templateTypography.palette.accent}
            onChange={(value) => patchTypography({ backgroundColor: value })}
          />
        ) : (
          <div className="flex gap-1 pb-0.5">
            <Button
              type="button"
              variant={typography.fontWeight >= 700 ? 'default' : 'outline'}
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              aria-label="Bold"
              aria-pressed={typography.fontWeight >= 700}
              onClick={toggleBold}
            >
              <Bold className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant={(typography.strokeWidth ?? 0) > 0 ? 'default' : 'outline'}
              size="icon"
              className="min-h-[44px] min-w-[44px] text-xs font-bold"
              aria-label="Outline"
              aria-pressed={(typography.strokeWidth ?? 0) > 0}
              onClick={toggleOutline}
            >
              O
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-1">
        {(
          [
            { align: 'left' as const, Icon: AlignLeft },
            { align: 'center' as const, Icon: AlignCenter },
            { align: 'right' as const, Icon: AlignRight },
          ] as const
        ).map(({ align, Icon }) => (
          <Button
            key={align}
            type="button"
            variant={(layer.position.align ?? 'center') === align ? 'default' : 'outline'}
            size="icon"
            className="min-h-[44px] min-w-[44px] flex-1"
            aria-label={`Align ${align}`}
            aria-pressed={(layer.position.align ?? 'center') === align}
            onClick={() => setAlign(align)}
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        ))}
      </div>
    </div>
  );
}

function detectActivePreset(layer: VideoSceneLayer): VideoTextPresetId | null {
  if (layer.kind === 'cta') return 'cta';
  if (layer.typography) return null;

  switch (layer.textStyle) {
    case 'subheadline':
      return 'subtitle';
    case 'promo':
      return 'promo';
    case 'footer':
      return 'label';
    case 'body':
      return 'body';
    default:
      return 'title';
  }
}
