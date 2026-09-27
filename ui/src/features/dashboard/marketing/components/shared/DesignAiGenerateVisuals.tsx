import { Sparkles } from 'lucide-react';

import {
  VisualChoiceButton,
  marketingAiSuggestionPreviewFrameClass,
} from '@/features/dashboard/marketing/components/shared/CalendarAiGenerateVisuals';
import type {
  DesignAiBackgroundOption,
  DesignAiFontOption,
  DesignAiLayoutOption,
} from '@/features/dashboard/marketing/lib/designAiGenerateOptions';
import type { DesignCampaignCategory } from '@/features/dashboard/marketing/lib/designAiTokens';
import { CAMPAIGN_CATEGORY_LABELS } from '@/features/dashboard/marketing/lib/designCanvasTypes';

import { cn } from '@/lib/utils';

export { VisualChoiceButton, marketingAiSuggestionPreviewFrameClass };

/** Mini Quiet Coast editorial promo — eyebrow, serif headline, accent rule, outline CTA. */
export function DesignSuggestionPreview({
  palette,
  className,
}: {
  palette: { primary: string; secondary: string; accent: string };
  className?: string;
}) {
  return (
    <div
      className={cn(marketingAiSuggestionPreviewFrameClass, className)}
      style={{
        background: `linear-gradient(155deg, ${palette.primary} 0%, ${mixPreview(palette.primary, palette.secondary, 0.45)} 55%, ${palette.secondary} 100%)`,
      }}
      aria-hidden
    >
      {/* Soft photo-wash texture (no real image — still reads as a stay promo) */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 70% 20%, rgba(255,255,255,0.55), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(0,0,0,0.12), transparent 50%)',
        }}
      />
      {/* Bottom scrim for type legibility — same device as real Quiet Coast presets */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${palette.primary}cc 55%, ${mixPreview(palette.primary, '#000000', 0.35)} 100%)`,
        }}
      />
      <div className="absolute inset-x-3 bottom-3 top-3 flex flex-col">
        <span
          className="text-[8px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: `${palette.secondary}dd` }}
        >
          Weekend stay
        </span>
        <span
          className="mt-2 font-serif text-[18px] font-semibold leading-[1.02] tracking-tight"
          style={{ color: palette.secondary }}
        >
          Soft
          <br />
          escape
        </span>
        <span className="mt-2 text-[9px] leading-snug" style={{ color: `${palette.secondary}cc` }}>
          Pool · Wi‑Fi · Kitchen
        </span>
        <span className="mt-2 h-px w-9 shrink-0" style={{ background: palette.accent }} />
        <div className="mt-auto flex items-center justify-between gap-2">
          <span
            className="rounded-full border px-2.5 py-1 text-[8px] font-semibold tracking-wide"
            style={{ borderColor: `${palette.secondary}aa`, color: palette.secondary }}
          >
            Book now
          </span>
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: palette.accent }}
          >
            ₱4,200
          </span>
        </div>
      </div>
    </div>
  );
}

/** Tiny hex mixer for preview gradients only — not a general color util. */
function mixPreview(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return { r: 128, g: 128, b: 128 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const x = parse(a);
  const y = parse(b);
  const w = Math.max(0, Math.min(1, t));
  const r = Math.round(x.r * (1 - w) + y.r * w);
  const g = Math.round(x.g * (1 - w) + y.g * w);
  const bl = Math.round(x.b * (1 - w) + y.b * w);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function LayoutThumb({ preview }: { preview: DesignAiLayoutOption['preview'] }) {
  if (preview === 'auto') {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }
  if (preview === 'hero') {
    return (
      <div className="relative size-full overflow-hidden rounded-md bg-[#24a88e]">
        <span className="absolute inset-x-1 bottom-1 top-6 rounded-sm bg-white/25" />
        <span className="absolute left-1 right-1 top-1 h-2 rounded-sm bg-white/40" />
      </div>
    );
  }
  if (preview === 'split') {
    return (
      <div className="flex size-full overflow-hidden rounded-md">
        <div className="h-full w-2/5 bg-[#e8752a]" />
        <div className="h-full flex-1 bg-[#fff7eb]" />
      </div>
    );
  }
  if (preview === 'card') {
    return (
      <div className="bg-muted/40 flex size-full items-center justify-center rounded-md p-1">
        <div className="bg-background size-full rounded-[3px] shadow-sm" />
      </div>
    );
  }
  if (preview === 'frame') {
    return (
      <div
        className="size-full rounded-md p-0.5"
        style={{ background: 'linear-gradient(135deg, #e8752a, #24a88e)' }}
      >
        <div className="bg-background size-full rounded-[3px]" />
      </div>
    );
  }
  if (preview === 'photo-bottom') {
    return (
      <div className="relative size-full overflow-hidden rounded-md bg-[#24a88e]">
        <span className="absolute left-1 right-1 top-1 h-2 rounded-sm bg-white/40" />
        <span className="absolute inset-x-1 bottom-1 top-5 rounded-sm bg-[#b7a99a]" />
      </div>
    );
  }
  if (preview === 'left-stack') {
    return (
      <div className="size-full rounded-md bg-[#24a88e] p-1">
        <div className="flex size-full flex-col items-start justify-center gap-0.5">
          <span className="h-1 w-3/4 rounded-sm bg-white/70" />
          <span className="h-2 w-2/3 rounded-sm bg-white/90" />
          <span className="h-1 w-1/2 rounded-sm bg-white/60" />
        </div>
      </div>
    );
  }
  // editorial
  return (
    <div className="bg-muted/40 flex size-full flex-col items-center justify-center gap-1 rounded-md p-1">
      <span className="bg-primary/70 h-1.5 w-3/4 rounded-sm" />
      <span className="bg-primary/50 h-1 w-1/2 rounded-sm" />
      <span className="bg-primary/35 h-1 w-2/3 rounded-sm" />
    </div>
  );
}

function BackgroundThumb({ preview }: { preview: DesignAiBackgroundOption['preview'] }) {
  if (preview === 'auto') {
    return (
      <div className="bg-muted/70 text-muted-foreground flex size-full items-center justify-center rounded-md">
        <Sparkles className="size-3.5" aria-hidden />
      </div>
    );
  }
  if (preview === 'photo') {
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
  if (preview === 'solid') {
    return <div className="bg-primary size-full rounded-md" />;
  }
  if (preview === 'gradient') {
    return (
      <div
        className="size-full rounded-md"
        style={{ background: 'linear-gradient(165deg, #24a88e, #fff7eb)' }}
      />
    );
  }
  // wash
  return <div className="size-full rounded-md bg-[#fff7eb]" />;
}

export function DesignLayoutOptionPreview({ option }: { option: DesignAiLayoutOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <LayoutThumb preview={option.preview} />
    </div>
  );
}

export function DesignFontOptionPreview({ option }: { option: DesignAiFontOption }) {
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

export function DesignBackgroundOptionPreview({ option }: { option: DesignAiBackgroundOption }) {
  return (
    <div className="bg-muted/30 size-9 shrink-0 overflow-hidden rounded-md border border-black/5 p-0.5">
      <BackgroundThumb preview={option.preview} />
    </div>
  );
}

export function DesignCategoryChips({
  value,
  disabled,
  onChange,
}: {
  value: DesignCampaignCategory;
  disabled?: boolean;
  onChange: (category: DesignCampaignCategory) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Category">
      {(Object.entries(CAMPAIGN_CATEGORY_LABELS) as Array<[DesignCampaignCategory, string]>).map(
        ([id, label]) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={cn(
                'focus-visible:ring-ring min-h-[44px] min-w-0 cursor-pointer rounded-full border px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 sm:px-2 sm:text-xs',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-background text-foreground hover:bg-background/80'
              )}
            >
              {label}
            </button>
          );
        }
      )}
    </div>
  );
}
