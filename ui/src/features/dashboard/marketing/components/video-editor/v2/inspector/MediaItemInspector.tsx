import { Replace, Trash2 } from 'lucide-react';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import {
  Field,
  OptionSelect,
  TimingFields,
  type InspectorActions,
} from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import { sourceDurationFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  VIDEO_PLAYBACK_RATES,
  type MediaItem,
  type VideoPlaybackRate,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import { VIDEO_MOTION_OVERRIDES } from '@/features/dashboard/marketing/lib/video/videoMotionProfiles';
import type { VideoTransition } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoOverlayMode } from '@/features/dashboard/marketing/lib/video/videoStoryboardRecipes';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const TRANSITIONS: Array<{ value: VideoTransition; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide-left', label: 'Slide left' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'push-cut', label: 'Push cut' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'clock-wipe', label: 'Clock wipe' },
  { value: 'flip', label: 'Flip' },
  { value: 'zoom-in-out', label: 'Zoom in out' },
];

const OVERLAYS: Array<{ value: VideoOverlayMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'soft-scrim', label: 'Soft scrim' },
  { value: 'bottom-band', label: 'Bottom band' },
  { value: 'top-band', label: 'Top band' },
];

const MOTIONS = [{ value: 'template', label: 'Template default' }, ...VIDEO_MOTION_OVERRIDES];

type Props = { item: MediaItem; actions: InspectorActions };

export function MediaItemInspector({ item, actions }: Props) {
  const { project } = actions;
  const main = project.tracks[0]!;
  const isMain = main.items.some((i) => i.id === item.id);
  const isFirstMain = isMain && main.items[0]?.id === item.id;
  const isVideo = item.type === 'video';
  const missing = !item.media.url.trim();
  const patch = (changes: Partial<MediaItem>) =>
    actions.update(item.id, (current) => ({ ...(current as MediaItem), ...changes }));
  const patchTransform = (changes: Partial<MediaItem['transform']>) =>
    patch({ transform: { ...item.transform, ...changes } });
  const adjust = item.adjust ?? { brightness: 1, contrast: 1, saturation: 1 };
  const sourceFrames = sourceDurationFrames(item.media, project.fps);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 flex-1 gap-1.5"
          onClick={() => actions.replaceMedia(item.id)}
        >
          <Replace className="size-4" aria-hidden />
          {missing ? 'Choose media' : 'Replace'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Delete clip"
          onClick={() => actions.remove(item.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      {missing ? <p className="text-xs text-amber-600">This clip has no media yet.</p> : null}

      <TimingFields item={item} actions={actions} />

      {isVideo ? (
        <section className="space-y-3" aria-label="Video">
          <OptionSelect<string>
            label="Speed"
            value={String(item.playbackRate ?? 1)}
            options={VIDEO_PLAYBACK_RATES.map((rate) => ({
              value: String(rate),
              label: `${rate}x`,
            }))}
            onChange={(value) => actions.setRate(item.id, Number(value) as VideoPlaybackRate)}
          />
          <NumberSlider
            label="Volume"
            unit="%"
            min={0}
            max={100}
            step={1}
            value={Math.round((item.volume ?? 1) * 100)}
            onChange={(value) => patch({ volume: value / 100 })}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm">Mute original sound</span>
            <Switch
              aria-label="Mute original sound"
              checked={item.muted === true}
              onCheckedChange={(checked) => patch({ muted: checked })}
            />
          </div>
          {sourceFrames ? (
            <NumberSlider
              label="Start in source"
              unit="s"
              min={0}
              max={Math.max(0, Math.round((sourceFrames / project.fps) * 10) / 10 - 0.1)}
              step={0.1}
              value={Math.round(((item.trimBeforeFrames ?? 0) / project.fps) * 10) / 10}
              onChange={(value) => patch({ trimBeforeFrames: Math.round(value * project.fps) })}
            />
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3" aria-label="Look">
        <OptionSelect<'cover' | 'contain'>
          label="Fit"
          value={item.fit}
          options={[
            { value: 'cover', label: 'Fill frame' },
            { value: 'contain', label: 'Show whole' },
          ]}
          onChange={(fit) => patch({ fit })}
        />
        {!isMain ? (
          <>
            <NumberSlider
              label="Size"
              unit="%"
              min={5}
              max={200}
              step={1}
              value={Math.round(item.transform.widthPct)}
              onChange={(widthPct) => patchTransform({ widthPct })}
            />
            <NumberSlider
              label="Left"
              unit="%"
              min={0}
              max={100}
              step={1}
              value={Math.round(item.transform.x)}
              onChange={(x) => patchTransform({ x })}
            />
            <NumberSlider
              label="Top"
              unit="%"
              min={0}
              max={100}
              step={1}
              value={Math.round(item.transform.y)}
              onChange={(y) => patchTransform({ y })}
            />
            <NumberSlider
              label="Rotation"
              unit="deg"
              min={-180}
              max={180}
              step={1}
              value={Math.round(item.transform.rotation)}
              onChange={(rotation) => patchTransform({ rotation })}
            />
            <NumberSlider
              label="Opacity"
              unit="%"
              min={0}
              max={100}
              step={1}
              value={Math.round(item.transform.opacity * 100)}
              onChange={(value) => patchTransform({ opacity: value / 100 })}
            />
          </>
        ) : null}
        <NumberSlider
          label="Brightness"
          unit="%"
          min={0}
          max={200}
          step={1}
          value={Math.round(adjust.brightness * 100)}
          onChange={(v) => patch({ adjust: { ...adjust, brightness: v / 100 } })}
        />
        <NumberSlider
          label="Contrast"
          unit="%"
          min={0}
          max={200}
          step={1}
          value={Math.round(adjust.contrast * 100)}
          onChange={(v) => patch({ adjust: { ...adjust, contrast: v / 100 } })}
        />
        <NumberSlider
          label="Saturation"
          unit="%"
          min={0}
          max={200}
          step={1}
          value={Math.round(adjust.saturation * 100)}
          onChange={(v) => patch({ adjust: { ...adjust, saturation: v / 100 } })}
        />
      </section>

      {isMain ? (
        <section className="space-y-3" aria-label="Scene">
          {item.type === 'image' || item.motion !== undefined ? (
            <OptionSelect<string>
              label="Camera motion"
              value={item.motion ?? 'template'}
              options={MOTIONS}
              onChange={(value) =>
                patch({ motion: value === 'template' ? undefined : (value as MediaItem['motion']) })
              }
            />
          ) : null}
          <OptionSelect<VideoOverlayMode>
            label="Photo wash"
            value={item.overlay ?? 'none'}
            options={OVERLAYS}
            onChange={(overlay) => patch({ overlay })}
          />
          {!isFirstMain ? (
            <OptionSelect<VideoTransition>
              label="Transition in"
              value={item.transitionIn?.type ?? 'none'}
              options={TRANSITIONS}
              onChange={(type) => actions.setTransition(item.id, type)}
            />
          ) : null}
        </section>
      ) : (
        <Field label="Layer">
          <p className="text-muted-foreground text-xs">
            Drag the clip on the preview to move or resize it.
          </p>
        </Field>
      )}
    </div>
  );
}
