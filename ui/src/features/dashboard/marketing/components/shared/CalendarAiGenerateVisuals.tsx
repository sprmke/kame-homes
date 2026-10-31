import type { ReactNode } from 'react';

import { Sparkles } from 'lucide-react';

import type {
  CalendarAiBackgroundOption,
  CalendarAiFontOption,
  CalendarAiLayoutOption,
  CalendarAiSuggestion,
} from '@/features/dashboard/marketing/lib/calendarAiGenerateOptions';

import { cn } from '@/lib/utils';

/** Shared frame for Look suggestion cards — square reads closer to IG post/story output. */
export const marketingAiSuggestionPreviewFrameClass =
  'relative aspect-square w-full overflow-hidden rounded-lg';

/** Mini availability calendar — mirrors bubble-style AI calendar templates. */
export function SuggestionThemePreview({
  palette,
  className,
}: {
  palette: CalendarAiSuggestion['palette'];
  className?: string;
}) {
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  // Three weeks of day chips — uses the taller square frame.
  const days: Array<{ n: number; kind: 'muted' | 'available' | 'today' }> = [
    { n: 1, kind: 'muted' },
    { n: 2, kind: 'available' },
    { n: 3, kind: 'available' },
    { n: 4, kind: 'muted' },
    { n: 5, kind: 'available' },
    { n: 6, kind: 'available' },
    { n: 7, kind: 'muted' },
    { n: 8, kind: 'muted' },
    { n: 9, kind: 'available' },
    { n: 10, kind: 'available' },
    { n: 11, kind: 'muted' },
    { n: 12, kind: 'available' },
    { n: 13, kind: 'today' },
    { n: 14, kind: 'muted' },
    { n: 15, kind: 'available' },
    { n: 16, kind: 'available' },
    { n: 17, kind: 'muted' },
    { n: 18, kind: 'available' },
    { n: 19, kind: 'available' },
    { n: 20, kind: 'muted' },
    { n: 21, kind: 'available' },
  ];

  return (
    <div
      className={cn(
        marketingAiSuggestionPreviewFrameClass,
        'flex flex-col px-3 pb-3 pt-2.5',
        className
      )}
      style={{
        background: `linear-gradient(165deg, ${palette.canvas} 0%, ${palette.available}22 100%)`,
      }}
      aria-hidden
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="block truncate text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: `${palette.ink}99` }}
          >
            August · Open dates
          </span>
          <span
            className="mt-0.5 block text-[11px] font-bold leading-tight"
            style={{ color: palette.ink }}
          >
            Your stay
          </span>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold"
          style={{ background: palette.today, color: palette.canvas }}
        >
          Open
        </span>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdays.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="text-center text-[7px] font-semibold uppercase"
            style={{ color: `${palette.ink}66` }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = day.kind === 'today';
          const isAvailable = day.kind === 'available';
          return (
            <span
              key={day.n}
              className="flex aspect-square items-center justify-center rounded-full text-[9px] font-semibold leading-none"
              style={{
                background: isToday
                  ? palette.today
                  : isAvailable
                    ? palette.available
                    : 'transparent',
                color: isToday ? palette.canvas : isAvailable ? palette.ink : `${palette.ink}55`,
                boxShadow: isToday ? `0 0 0 2px ${palette.today}88` : undefined,
              }}
            >
              {day.n}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <span
          className="flex items-center gap-1 text-[7px] font-medium"
          style={{ color: palette.ink }}
        >
          <span className="size-2 rounded-full" style={{ background: palette.available }} />
          Open
        </span>
        <span
          className="flex items-center gap-1 text-[7px] font-medium"
          style={{ color: palette.ink }}
        >
          <span
            className="size-2 rounded-full ring-2"
            style={{ background: palette.today, boxShadow: `0 0 0 1px ${palette.today}` }}
          />
          Today
        </span>
      </div>
    </div>
  );
}

function LayoutThumb({ preview }: { preview: CalendarAiLayoutOption['preview'] }) {
  if (preview === 'auto') {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }

  if (preview === 'bubbles') {
    return (
      <div className="bg-muted/40 flex size-full items-center justify-center gap-0.5 rounded-md p-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-primary/35 border-primary/40 size-2.5 rounded-full border"
            style={{ opacity: 0.55 + i * 0.15 }}
          />
        ))}
      </div>
    );
  }

  if (preview === 'widget') {
    return (
      <div className="grid size-full grid-cols-3 gap-0.5 rounded-md bg-[#fff8e7] p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="rounded-[2px] bg-[#f2a154]/55" />
        ))}
      </div>
    );
  }

  if (preview === 'type') {
    return (
      <div className="bg-muted/40 flex size-full flex-col items-center justify-center rounded-md px-1">
        <span className="text-foreground text-[10px] font-bold leading-none tracking-tight">
          Aug
        </span>
        <span className="text-muted-foreground mt-0.5 text-[7px] font-medium uppercase tracking-wider">
          2026
        </span>
      </div>
    );
  }

  if (preview === 'geo') {
    return (
      <div className="bg-muted/40 relative size-full overflow-hidden rounded-md">
        <span className="bg-primary/40 absolute left-1 top-1 size-3 rotate-12 rounded-[2px]" />
        <span className="bg-primary/25 absolute bottom-1 right-1 size-3.5 rounded-full" />
        <span className="border-primary/50 absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border" />
      </div>
    );
  }

  if (preview === 'garden') {
    return (
      <div className="relative size-full overflow-hidden rounded-md bg-[#f4faf2]">
        <span className="absolute -left-1 bottom-0 size-4 rounded-full bg-[#8fbc8f]/55" />
        <span className="absolute -right-0.5 top-0 size-3 rounded-full bg-[#a8c4a0]/70" />
        <span className="absolute bottom-1 right-1.5 size-2 rounded-full bg-[#6b8f71]/50" />
      </div>
    );
  }

  if (preview === 'photo') {
    return (
      <div
        className="size-full rounded-md"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.85)), linear-gradient(135deg, #c4b5a5, #8a9eab)',
        }}
      />
    );
  }

  // dusk
  return (
    <div
      className="size-full rounded-md"
      style={{
        background: 'linear-gradient(160deg, #ebe4f7 0%, #c9b8e0 55%, #a890c8 100%)',
      }}
    />
  );
}

function BackgroundThumb({ preview }: { preview: CalendarAiBackgroundOption['preview'] }) {
  if (preview === 'auto') {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }
  if (preview === 'cream') {
    return <div className="size-full rounded-md bg-[#fff8ef] ring-1 ring-black/5" />;
  }
  if (preview === 'gradient') {
    return (
      <div
        className="size-full rounded-md"
        style={{ background: 'linear-gradient(165deg, #f7f4ff, #e8f6f2)' }}
      />
    );
  }
  if (preview === 'dots') {
    return (
      <div
        className="size-full rounded-md bg-[#faf7ff]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(120,100,180,0.35) 1px, transparent 1px)',
          backgroundSize: '5px 5px',
        }}
      />
    );
  }
  return (
    <div
      className="size-full rounded-md"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0.9)), linear-gradient(135deg, #b7a99a, #7f96a3)',
      }}
    />
  );
}

export function LayoutOptionPreview({ option }: { option: CalendarAiLayoutOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <LayoutThumb preview={option.preview} />
    </div>
  );
}

export function FontOptionPreview({ option }: { option: CalendarAiFontOption }) {
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

export function BackgroundOptionPreview({ option }: { option: CalendarAiBackgroundOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <BackgroundThumb preview={option.preview} />
    </div>
  );
}

export function VisualChoiceButton({
  active,
  disabled,
  onClick,
  title,
  hint,
  preview,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  preview: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${title}. ${hint}`}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
        active ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-muted/50'
      )}
    >
      {preview}
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-medium leading-tight">{title}</span>
        <span className="text-muted-foreground block text-[11px] leading-tight">{hint}</span>
      </span>
    </button>
  );
}
