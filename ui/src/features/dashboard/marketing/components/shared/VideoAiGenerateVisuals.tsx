import { Film, Sparkles, Wind, Zap } from 'lucide-react';

import {
  VisualChoiceButton,
  marketingAiSuggestionPreviewFrameClass,
} from '@/features/dashboard/marketing/components/shared/CalendarAiGenerateVisuals';
import type {
  VideoAiDurationOption,
  VideoAiFontOption,
  VideoAiMotionOption,
  VideoAiSuggestion,
} from '@/features/dashboard/marketing/lib/videoAiGenerateOptions';

import { cn } from '@/lib/utils';

export { VisualChoiceButton, marketingAiSuggestionPreviewFrameClass };

/** Mini video frame — photo wash, bottom scrim, headline, scene filmstrip (Quiet Coast Motion). */
export function VideoSuggestionPreview({
  mood,
  sceneHint,
  className,
}: {
  mood: { from: string; to: string };
  sceneHint: number;
  className?: string;
}) {
  const scenes = Math.max(3, Math.min(5, sceneHint));
  return (
    <div
      className={cn(marketingAiSuggestionPreviewFrameClass, className)}
      style={{ background: `linear-gradient(145deg, ${mood.from} 0%, ${mood.to} 100%)` }}
      aria-hidden
    >
      {/* Soft “property photo” blobs so it reads as a clip, not a flat swatch */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `
            radial-gradient(ellipse at 25% 35%, rgba(255,255,255,0.35), transparent 45%),
            radial-gradient(ellipse at 78% 60%, rgba(0,0,0,0.22), transparent 40%)
          `,
        }}
      />
      {/* Bottom scrim — same device as live video overlays */}
      <div
        className="absolute inset-x-0 bottom-0 h-[58%]"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${mood.to}99 42%, ${mood.to}ee 100%)`,
        }}
      />
      <div className="absolute left-1/2 top-[38%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 ring-1 ring-white/30 backdrop-blur-[1px]">
        <span className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white/90" />
      </div>
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-[2px]">
        <Film className="size-3 text-white/90" aria-hidden />
        <span className="text-[8px] font-semibold tracking-wide text-white/90">Clip</span>
      </div>
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
        <span className="font-serif text-[17px] font-semibold leading-tight tracking-tight text-white drop-shadow-sm">
          Soft stay
        </span>
        <span className="text-[8px] font-medium uppercase tracking-[0.16em] text-white/75">
          This weekend · 3 scenes
        </span>
        <div className="mt-1 flex items-center gap-1">
          {Array.from({ length: scenes }).map((_, index) => {
            const isHook = index === 0;
            const isCta = index === scenes - 1;
            return (
              <span
                key={index}
                className="h-1.5 rounded-full"
                style={{
                  flex: isHook || isCta ? 1.35 : 1,
                  background: isCta
                    ? 'rgba(255,255,255,0.95)'
                    : isHook
                      ? 'rgba(255,255,255,0.8)'
                      : 'rgba(255,255,255,0.45)',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Longest offered duration — bar width is proportional to this. */
const MAX_PREVIEW_SECONDS = 25;

function DurationThumb({ seconds }: { seconds: number | null }) {
  if (seconds == null) {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }
  const widthPct = Math.round(Math.min(1, seconds / MAX_PREVIEW_SECONDS) * 100);
  return (
    <div className="bg-muted/40 flex size-full items-center rounded-md p-1.5">
      <span className="bg-primary/70 h-1.5 rounded-full" style={{ width: `${widthPct}%` }} />
    </div>
  );
}

function MotionThumb({ preview }: { preview: VideoAiMotionOption['preview'] }) {
  if (preview === 'auto') {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }
  if (preview === 'calm') {
    return (
      <div className="bg-muted/40 flex size-full items-center justify-center rounded-md">
        <Wind className="text-primary/70 size-4" aria-hidden />
      </div>
    );
  }
  if (preview === 'energetic') {
    return (
      <div className="bg-muted/40 flex size-full items-center justify-center rounded-md">
        <Zap className="text-primary/70 size-4" aria-hidden />
      </div>
    );
  }
  return (
    <div className="bg-muted/40 flex size-full items-center justify-center rounded-md">
      <Film className="text-primary/70 size-4" aria-hidden />
    </div>
  );
}

export function VideoDurationOptionPreview({ option }: { option: VideoAiDurationOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <DurationThumb seconds={option.seconds} />
    </div>
  );
}

export function VideoFontOptionPreview({ option }: { option: VideoAiFontOption }) {
  return (
    <div className="bg-muted/30 text-foreground flex size-9 shrink-0 items-center justify-center rounded-md border border-black/5">
      <span
        className="text-sm font-semibold leading-none"
        style={{ fontFamily: option.fontFamily }}
      >
        {option.sample}
      </span>
    </div>
  );
}

export function VideoMotionOptionPreview({ option }: { option: VideoAiMotionOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <MotionThumb preview={option.preview} />
    </div>
  );
}

export function VideoCategoryChips({
  value,
  disabled,
  labels,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  labels: Record<string, string>;
  onChange: (category: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1" role="group" aria-label="Category">
      {Object.entries(labels).map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={cn(
              'focus-visible:ring-ring min-h-[36px] min-w-0 cursor-pointer rounded-full border px-1 py-1 text-center text-[10px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 sm:text-[11px]',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/70 bg-background text-foreground hover:bg-background/80'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export type { VideoAiSuggestion };
