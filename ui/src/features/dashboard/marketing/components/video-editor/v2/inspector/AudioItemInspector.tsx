import { Replace, Trash2 } from 'lucide-react';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import {
  TimingFields,
  type InspectorActions,
} from '@/features/dashboard/marketing/components/video-editor/v2/inspector/InspectorShared';
import type { AudioItem } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type Props = { item: AudioItem; actions: InspectorActions };

export function AudioItemInspector({ item, actions }: Props) {
  const { fps } = actions.project;
  const patch = (changes: Partial<AudioItem>) =>
    actions.update(item.id, (current) => ({ ...(current as AudioItem), ...changes }));
  const toSec = (frames: number | undefined) => Math.round(((frames ?? 0) / fps) * 10) / 10;
  const maxFade = Math.max(0, toSec(item.durationInFrames));

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
          Replace
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          aria-label="Delete audio"
          onClick={() => actions.remove(item.id)}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      {item.title ? (
        <p className="truncate text-sm font-medium">
          {item.title}
          {item.artist ? (
            <span className="text-muted-foreground font-normal"> by {item.artist}</span>
          ) : null}
        </p>
      ) : null}

      <TimingFields item={item} actions={actions} />

      <NumberSlider
        label="Volume"
        unit="%"
        min={0}
        max={100}
        step={1}
        value={Math.round(item.volume * 100)}
        onChange={(v) => patch({ volume: v / 100 })}
      />
      <NumberSlider
        label="Fade in"
        unit="s"
        min={0}
        max={maxFade}
        step={0.1}
        value={toSec(item.fadeInFrames)}
        onChange={(v) => patch({ fadeInFrames: Math.round(v * fps) })}
      />
      <NumberSlider
        label="Fade out"
        unit="s"
        min={0}
        max={maxFade}
        step={0.1}
        value={toSec(item.fadeOutFrames)}
        onChange={(v) => patch({ fadeOutFrames: Math.round(v * fps) })}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm">Loop to fill</span>
        <Switch
          aria-label="Loop to fill"
          checked={item.loop === true}
          onCheckedChange={(checked) => patch({ loop: checked })}
        />
      </div>
    </div>
  );
}
