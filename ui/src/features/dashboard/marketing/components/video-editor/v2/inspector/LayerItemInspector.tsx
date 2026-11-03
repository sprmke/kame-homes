import { Trash2 } from 'lucide-react';

import {
  OptionSelect,
  TimingFields,
  type InspectorActions,
} from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { VideoTextStyleControls } from '@/features/dashboard/marketing/components/video-editor/VideoTextStyleControls';
import type {
  LayerItem,
  TextAnimation,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ENTRANCES: Array<{ value: TextAnimation; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'template', label: 'Template default' },
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
];

const EXITS: Array<{ value: TextAnimation; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'rise', label: 'Rise' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'pop', label: 'Pop' },
  { value: 'typewriter', label: 'Typewriter' },
];

type Props = { item: LayerItem; actions: InspectorActions };

export function LayerItemInspector({ item, actions }: Props) {
  const layer = item.layer;
  const isText = layer.kind === 'text' || layer.kind === 'cta';
  const isSlots = layer.kind === 'slots';
  const patchLayer = (changes: Partial<VideoSceneLayer>) =>
    actions.update(item.id, (current) => ({
      ...(current as LayerItem),
      layer: { ...(current as LayerItem).layer, ...changes },
    }));
  const setAnimation = (key: 'animationIn' | 'animationOut', type: TextAnimation) =>
    actions.update(item.id, (current) => {
      const base = { ...(current as LayerItem) };
      const duration = (base[key]?.durationInFrames ?? 12) || 12;
      if (type === 'none') delete base[key];
      else base[key] = { type, durationInFrames: duration };
      return base;
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Delete text"
          onClick={() => actions.remove(item.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>

      {isText ? (
        <div className="space-y-1.5">
          <Label htmlFor={`text-${item.id}`} className="text-xs">
            Text
          </Label>
          <Textarea
            id={`text-${item.id}`}
            value={layer.text ?? ''}
            rows={3}
            maxLength={500}
            onChange={(event) => patchLayer({ text: event.target.value })}
          />
        </div>
      ) : null}

      {isSlots ? (
        <div className="space-y-1.5">
          <Label htmlFor={`lines-${item.id}`} className="text-xs">
            Chips, one per line
          </Label>
          <Textarea
            id={`lines-${item.id}`}
            value={(layer.lines ?? []).join('\n')}
            rows={4}
            onChange={(event) => patchLayer({ lines: event.target.value.split('\n').slice(0, 12) })}
          />
        </div>
      ) : null}

      <TimingFields item={item} actions={actions} />

      {isText ? (
        <VideoTextStyleControls
          layer={layer}
          templateTypography={actions.typography}
          onChange={patchLayer}
        />
      ) : null}

      <section className="space-y-3" aria-label="Animation">
        <OptionSelect<TextAnimation>
          label="Animate in"
          value={item.animationIn?.type ?? 'none'}
          options={ENTRANCES}
          onChange={(type) => setAnimation('animationIn', type)}
        />
        <OptionSelect<TextAnimation>
          label="Animate out"
          value={item.animationOut?.type ?? 'none'}
          options={EXITS}
          onChange={(type) => setAnimation('animationOut', type)}
        />
      </section>
    </div>
  );
}
