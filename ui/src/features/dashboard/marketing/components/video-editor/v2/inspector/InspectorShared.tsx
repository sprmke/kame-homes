import type { ReactNode } from 'react';

import { NumberSlider } from '@/features/dashboard/marketing/components/calendar-builder/components/controls/NumberSlider';
import { itemEnd } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type {
  VideoItem,
  VideoPlaybackRate,
  VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type { VideoTransition } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Everything an inspector can do to the project. Each call goes through the timeline ops. */
export type InspectorActions = {
  project: VideoProjectV2;
  typography: VideoTypographyContext;
  update: (itemId: string, updater: (item: VideoItem) => VideoItem) => void;
  trim: (itemId: string, edge: 'start' | 'end', frame: number) => void;
  moveTo: (itemId: string, frame: number) => void;
  setRate: (itemId: string, rate: VideoPlaybackRate) => void;
  setTransition: (itemId: string, type: VideoTransition) => void;
  replaceMedia: (itemId: string) => void;
  remove: (itemId: string) => void;
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function OptionSelect<T extends string>({
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
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Start and length in seconds (0.1 s steps), applied through trim and move. */
export function TimingFields({ item, actions }: { item: VideoItem; actions: InspectorActions }) {
  const { fps } = actions.project;
  const toSeconds = (frames: number) => Math.round((frames / fps) * 10) / 10;
  const toFrames = (seconds: number) => Math.round(seconds * fps);
  const onMain = actions.project.tracks[0]?.items.some((i) => i.id === item.id);
  return (
    <div className="space-y-3">
      {onMain ? null : (
        <NumberSlider
          label="Start"
          unit="s"
          min={0}
          max={60}
          step={0.1}
          value={toSeconds(item.from)}
          onChange={(value) => actions.moveTo(item.id, toFrames(value))}
        />
      )}
      <NumberSlider
        label="Length"
        unit="s"
        min={0.1}
        max={60}
        step={0.1}
        value={toSeconds(item.durationInFrames)}
        onChange={(value) => actions.trim(item.id, 'end', item.from + toFrames(value))}
      />
      <p className="text-muted-foreground text-[11px]">Ends at {toSeconds(itemEnd(item))} s</p>
    </div>
  );
}
