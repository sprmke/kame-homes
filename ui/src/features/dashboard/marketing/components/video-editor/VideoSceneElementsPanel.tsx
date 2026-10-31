import { useEffect } from 'react';

import {
  ImageIcon,
  Layers,
  List,
  MousePointerClick,
  Plus,
  Stamp,
  Trash2,
  Type,
} from 'lucide-react';
import { toast } from 'sonner';

import { VideoPropertyImagePicker } from '@/features/dashboard/marketing/components/video-editor/VideoPropertyImagePicker';
import { VideoTextStyleControls } from '@/features/dashboard/marketing/components/video-editor/VideoTextStyleControls';
import type { PropertyMediaItem } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';
import { inferBackgroundMediaType } from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { resolveLayerWidthPct } from '@/features/dashboard/marketing/lib/video/videoLayerSizing';
import type {
  VideoScene,
  VideoSceneLayer,
  VideoSceneTextFields,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  addSceneLayer,
  getSceneLayers,
  layerLabel,
  removeAllSceneLayers,
  removeSceneLayer,
  sceneBackgroundLayer,
  updateSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SceneChangeHandler = (scene: VideoScene) => void;
type AddLayerKind = 'background' | 'text' | 'cta' | 'image' | 'logo';

function layerIcon(layer: VideoSceneLayer) {
  switch (layer.kind) {
    case 'background':
    case 'image':
      return ImageIcon;
    case 'logo':
      return Stamp;
    case 'cta':
      return MousePointerClick;
    case 'slots':
      return List;
    default:
      return Type;
  }
}

function displayLabel(layers: VideoSceneLayer[], layer: VideoSceneLayer): string {
  const sameKind = layers.filter((item) => item.kind === layer.kind);
  const index = sameKind.findIndex((item) => item.id === layer.id) + 1;
  return layerLabel(layer, index);
}

function VideoLayerWidthControl({
  layer,
  onChange,
}: {
  layer: VideoSceneLayer;
  onChange: (widthPct: number) => void;
}) {
  return (
    <input
      type="range"
      min={8}
      max={90}
      value={resolveLayerWidthPct(layer)}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label="Size"
      className="accent-primary h-10 min-h-[44px] w-full cursor-pointer"
    />
  );
}

type Props = {
  scene: VideoScene;
  propertyImages: PropertyMediaItem[];
  templateTypography: VideoTypographyContext;
  logoUrl?: string | null;
  templateTextSeed?: VideoSceneTextFields;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onChange: SceneChangeHandler;
  elementFocusRequest?: number;
};

export function VideoSceneElementsPanel({
  scene,
  propertyImages,
  templateTypography,
  logoUrl = null,
  templateTextSeed,
  selectedElementId,
  onSelectElement,
  onChange,
  elementFocusRequest = 0,
}: Props) {
  const layers = getSceneLayers(scene);
  const hasBackground = Boolean(sceneBackgroundLayer(scene));

  useEffect(() => {
    if (!selectedElementId || elementFocusRequest <= 0) return;

    const row = document.getElementById(`video-layer-row-${selectedElementId}`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const focusTarget = row?.querySelector<HTMLElement>(
      'textarea, input:not([type="hidden"]):not([type="range"]), [role="combobox"]'
    );
    window.requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
    });
  }, [selectedElementId, elementFocusRequest]);

  const handleRemove = (layerId: string) => {
    const next = removeSceneLayer(scene, layerId);
    onChange(next);
    if (selectedElementId === layerId) {
      const remaining = getSceneLayers(next);
      onSelectElement(remaining[0]?.id ?? null);
    }
  };

  const handleAdd = (kind: AddLayerKind) => {
    if (kind === 'logo' && !logoUrl?.trim()) {
      toast.error('Upload an organization logo in org settings first.');
      return;
    }

    const next = addSceneLayer(scene, kind, {
      imageUrl: propertyImages[0]?.url ?? scene.imageUrl,
      logoUrl: logoUrl?.trim() ?? null,
      templateSeed: templateTextSeed,
      typography: templateTypography,
    });
    onChange(next);
    const added = getSceneLayers(next);
    onSelectElement(added[added.length - 1]?.id ?? null);
  };

  const handleClearAll = () => {
    onChange(removeAllSceneLayers(scene));
    onSelectElement(null);
  };

  const addOptions: { kind: AddLayerKind; label: string }[] = [
    ...(!hasBackground ? [{ kind: 'background' as const, label: 'Background' }] : []),
    { kind: 'image', label: 'Image' },
    ...(logoUrl?.trim() ? [{ kind: 'logo' as const, label: 'Logo' }] : []),
    { kind: 'text', label: 'Text' },
    { kind: 'cta', label: 'CTA' },
  ];

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-end gap-2">
        {layers.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive min-h-[44px] text-xs"
            onClick={handleClearAll}
          >
            Clear all
          </Button>
        ) : null}
      </div>

      {layers.length === 0 ? (
        <div className="border-border bg-muted/30 flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4">
          <Layers className="text-muted-foreground size-5" aria-hidden />
          <AddElementMenu options={addOptions} onAdd={handleAdd} />
        </div>
      ) : (
        <ul className="space-y-2">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              label={displayLabel(layers, layer)}
              scene={scene}
              templateTypography={templateTypography}
              propertyImages={propertyImages}
              selected={selectedElementId === layer.id}
              onSelect={() => onSelectElement(layer.id)}
              onRemove={() => handleRemove(layer.id)}
              onChange={onChange}
            />
          ))}
        </ul>
      )}

      {layers.length > 0 ? (
        <AddElementMenu options={addOptions} onAdd={handleAdd} fullWidth />
      ) : null}
    </div>
  );
}

function AddElementMenu({
  options,
  onAdd,
  fullWidth,
}: {
  options: { kind: AddLayerKind; label: string }[];
  onAdd: (kind: AddLayerKind) => void;
  fullWidth?: boolean;
}) {
  return (
    <ResponsiveOverflowMenu
      label="Add element"
      sheetTitle="Add element"
      actionGroups={[
        options.map((option) => ({
          key: option.kind,
          label: option.label,
          onSelect: () => onAdd(option.kind),
        })),
      ]}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('min-h-[44px] gap-1.5', fullWidth && 'w-full')}
          aria-label="Add element"
        >
          <Plus className="size-4" aria-hidden />
          Add element
        </Button>
      }
    />
  );
}

function LayerRow({
  layer,
  label,
  scene,
  templateTypography,
  propertyImages,
  selected,
  onSelect,
  onRemove,
  onChange,
}: {
  layer: VideoSceneLayer;
  label: string;
  scene: VideoScene;
  templateTypography: VideoTypographyContext;
  propertyImages: PropertyMediaItem[];
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: SceneChangeHandler;
}) {
  const Icon = layerIcon(layer);

  return (
    <li
      id={`video-layer-row-${layer.id}`}
      className={cn(
        'border-border bg-card overflow-hidden rounded-xl border transition-colors',
        selected && 'border-primary ring-primary/25 ring-2'
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
          aria-pressed={selected}
        >
          <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="truncate text-sm font-medium">{label}</span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] shrink-0"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {selected ? (
        <div className="border-border space-y-2 border-t px-3 py-3">
          {layer.kind === 'background' || layer.kind === 'image' ? (
            <>
              <VideoPropertyImagePicker
                images={propertyImages}
                selectedUrl={layer.imageUrl ?? null}
                onSelect={(url) => {
                  const item = propertyImages.find((entry) => entry.url === url);
                  onChange(
                    updateSceneLayer(scene, layer.id, {
                      imageUrl: url,
                      mediaType: item?.type ?? inferBackgroundMediaType(url),
                    })
                  );
                }}
              />
              <VideoLayerWidthControl
                layer={layer}
                onChange={(widthPct) => onChange(updateSceneLayer(scene, layer.id, { widthPct }))}
              />
            </>
          ) : layer.kind === 'logo' ? (
            <>
              {layer.imageUrl ? (
                <img
                  src={layer.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="mx-auto size-16 rounded-lg object-cover object-center"
                />
              ) : null}
              <VideoLayerWidthControl
                layer={layer}
                onChange={(widthPct) => onChange(updateSceneLayer(scene, layer.id, { widthPct }))}
              />
            </>
          ) : layer.kind === 'slots' ? (
            <textarea
              value={(layer.lines ?? []).join('\n')}
              onChange={(event) =>
                onChange(
                  updateSceneLayer(scene, layer.id, {
                    lines: event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                )
              }
              rows={4}
              aria-label={label}
              className="field-focus border-input bg-card placeholder:text-muted-foreground flex min-h-[88px] w-full rounded-md border px-3 py-2 text-sm"
            />
          ) : layer.kind === 'text' || layer.kind === 'cta' ? (
            <VideoTextStyleControls
              layer={layer}
              templateTypography={templateTypography}
              onChange={(patch) => onChange(updateSceneLayer(scene, layer.id, patch))}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
