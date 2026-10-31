import type { StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

/**
 * Chart segment fills — Tailwind 500 hex aligned with `STATUS_TONE_STYLES` dot classes
 * (rose, yellow, teal, amber, orange, sky, violet, slate).
 */
export const STATUS_TONE_HEX: Record<StatusTone, string> = {
  red: '#f43f5e',
  yellow: '#eab308',
  green: '#14b8a6',
  amber: '#f59e0b',
  orange: '#f97316',
  blue: '#0ea5e9',
  purple: '#8b5cf6',
  neutral: '#64748b',
};

export type StatusToneStyle = {
  badge: string;
  dot: string;
  pulse?: boolean;
};

/** Pill badges + dots for booking statuses, calendar pills, filters. */
export const STATUS_TONE_STYLES: Record<StatusTone, StatusToneStyle> = {
  red: {
    badge:
      'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200',
    dot: 'bg-rose-500',
    pulse: true,
  },
  yellow: {
    badge:
      'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-950/35 dark:text-yellow-100',
    dot: 'bg-yellow-500',
  },
  green: {
    badge:
      'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-500/30 dark:bg-teal-950/35 dark:text-teal-100',
    dot: 'bg-teal-500',
  },
  amber: {
    badge:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100',
    dot: 'bg-amber-500',
  },
  orange: {
    badge:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/35 dark:text-orange-100',
    dot: 'bg-orange-500',
  },
  blue: {
    badge:
      'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/35 dark:text-sky-100',
    dot: 'bg-sky-500',
  },
  purple: {
    badge:
      'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200',
    dot: 'bg-violet-500',
  },
  neutral: {
    badge:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600/40 dark:bg-slate-900/50 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
};

/**
 * Week/day time-grid stay blocks — status-tone chrome only (never brand primary).
 * `hover` is a darker wash of the same tone for stay-wide highlight.
 */
export const STATUS_TONE_CALENDAR_BLOCK: Record<StatusTone, { base: string; hover: string }> = {
  red: {
    base: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/45 dark:bg-rose-950/45 dark:text-rose-100',
    hover:
      'border-rose-500 bg-rose-100 text-rose-950 dark:border-rose-400 dark:bg-rose-900/55 dark:text-rose-50',
  },
  yellow: {
    base: 'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-500/45 dark:bg-yellow-950/40 dark:text-yellow-100',
    hover:
      'border-yellow-500 bg-yellow-100 text-yellow-950 dark:border-yellow-400 dark:bg-yellow-900/50 dark:text-yellow-50',
  },
  green: {
    base: 'border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-500/45 dark:bg-teal-950/40 dark:text-teal-100',
    hover:
      'border-teal-500 bg-teal-100 text-teal-950 dark:border-teal-400 dark:bg-teal-900/50 dark:text-teal-50',
  },
  amber: {
    base: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-100',
    hover:
      'border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-900/50 dark:text-amber-50',
  },
  orange: {
    base: 'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-500/45 dark:bg-orange-950/40 dark:text-orange-100',
    hover:
      'border-orange-500 bg-orange-100 text-orange-950 dark:border-orange-400 dark:bg-orange-900/50 dark:text-orange-50',
  },
  blue: {
    base: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/45 dark:bg-sky-950/40 dark:text-sky-100',
    hover:
      'border-sky-500 bg-sky-100 text-sky-950 dark:border-sky-400 dark:bg-sky-900/50 dark:text-sky-50',
  },
  purple: {
    base: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-500/45 dark:bg-violet-950/45 dark:text-violet-100',
    hover:
      'border-violet-500 bg-violet-100 text-violet-950 dark:border-violet-400 dark:bg-violet-900/55 dark:text-violet-50',
  },
  neutral: {
    base: 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500/45 dark:bg-slate-900/55 dark:text-slate-200',
    hover:
      'border-slate-500 bg-slate-200 text-slate-900 dark:border-slate-400 dark:bg-slate-800/70 dark:text-slate-50',
  },
};

export type StatusToneSurface = {
  color: string;
  bgColor: string;
  borderColor: string;
};

/** Kanban columns, workflow cards — text + surface + border from the same tone. */
export function statusToneSurfaceClasses(tone: StatusTone): StatusToneSurface {
  const map: Record<StatusTone, StatusToneSurface> = {
    red: {
      color: 'text-rose-800 dark:text-rose-200',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-200 dark:border-rose-500/30',
    },
    yellow: {
      color: 'text-yellow-900 dark:text-yellow-100',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/35',
      borderColor: 'border-yellow-200 dark:border-yellow-500/30',
    },
    green: {
      color: 'text-teal-900 dark:text-teal-100',
      bgColor: 'bg-teal-50 dark:bg-teal-950/35',
      borderColor: 'border-teal-200 dark:border-teal-500/30',
    },
    amber: {
      color: 'text-amber-900 dark:text-amber-100',
      bgColor: 'bg-amber-50 dark:bg-amber-950/35',
      borderColor: 'border-amber-200 dark:border-amber-500/30',
    },
    orange: {
      color: 'text-orange-800 dark:text-orange-100',
      bgColor: 'bg-orange-50 dark:bg-orange-950/35',
      borderColor: 'border-orange-200 dark:border-orange-500/30',
    },
    blue: {
      color: 'text-sky-900 dark:text-sky-100',
      bgColor: 'bg-sky-50 dark:bg-sky-950/35',
      borderColor: 'border-sky-200 dark:border-sky-500/30',
    },
    purple: {
      color: 'text-violet-800 dark:text-violet-200',
      bgColor: 'bg-violet-50 dark:bg-violet-950/40',
      borderColor: 'border-violet-200 dark:border-violet-500/30',
    },
    neutral: {
      color: 'text-slate-700 dark:text-slate-300',
      bgColor: 'bg-slate-100 dark:bg-slate-900/50',
      borderColor: 'border-slate-200 dark:border-slate-600/40',
    },
  };
  return map[tone];
}

export type SemanticBadgeVariant =
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';

const SEMANTIC_TONE: Record<SemanticBadgeVariant, StatusTone> = {
  success: 'green',
  warning: 'amber',
  danger: 'red',
  info: 'blue',
  neutral: 'neutral',
  pending: 'yellow',
};

export function semanticBadgeClasses(variant: SemanticBadgeVariant): string {
  return STATUS_TONE_STYLES[SEMANTIC_TONE[variant]].badge;
}

export function semanticBadgeDotClasses(variant: SemanticBadgeVariant): string {
  return STATUS_TONE_STYLES[SEMANTIC_TONE[variant]].dot;
}

/** Uppercase compact chips (resource kind, finance ledger, import mapping). */
export function compactStatusBadgeClasses(variant: SemanticBadgeVariant): string {
  return `inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${semanticBadgeClasses(variant)}`;
}

/** Sentence-case pill for inline verdicts and labels. */
export function softBadgeClasses(variant: SemanticBadgeVariant): string {
  return `inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${semanticBadgeClasses(variant)}`;
}

/** Border + fill + on-surface text for a semantic variant, kept as parts. */
export function semanticSurfaceClasses(variant: SemanticBadgeVariant): StatusToneSurface {
  return statusToneSurfaceClasses(SEMANTIC_TONE[variant]);
}

/** Callout / notice surfaces (AI verdict cards, alert strips). */
export function softSurfaceClasses(variant: SemanticBadgeVariant): string {
  const surface = semanticSurfaceClasses(variant);
  return `${surface.borderColor} ${surface.bgColor}`;
}

export function resourceKindBadgeClasses(kind: 'property' | 'parking'): string {
  return compactStatusBadgeClasses(kind === 'parking' ? 'warning' : 'success');
}

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export const ATTENTION_SEVERITY_STYLES: Record<
  AttentionSeverity,
  {
    dot: string;
    count: string;
    chip: string;
    chipInteractive: string;
    iconWrap: string;
  }
> = {
  critical: {
    dot: STATUS_TONE_STYLES.red.dot,
    count: 'text-rose-800 dark:text-rose-200',
    chip: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-950/40',
    chipInteractive:
      'border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:hover:bg-rose-950/55',
    iconWrap: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    dot: STATUS_TONE_STYLES.amber.dot,
    count: 'text-amber-900 dark:text-amber-100',
    chip: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/35',
    chipInteractive:
      'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/35 dark:hover:bg-amber-950/50',
    iconWrap: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    dot: STATUS_TONE_STYLES.blue.dot,
    count: 'text-sky-900 dark:text-sky-100',
    chip: 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/35',
    chipInteractive:
      'border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-950/35 dark:hover:bg-sky-950/50',
    iconWrap: 'text-sky-700 dark:text-sky-400',
  },
};

export const LISTING_STATUS_STYLES = {
  ACTIVE: {
    label: 'Active',
    badge: semanticBadgeClasses('success'),
    dot: semanticBadgeDotClasses('success'),
  },
  INACTIVE: {
    label: 'Inactive',
    badge: semanticBadgeClasses('neutral'),
    dot: semanticBadgeDotClasses('neutral'),
  },
} as const;

export function toneBadgeClasses(tone: StatusTone): string {
  return STATUS_TONE_STYLES[tone].badge;
}

/** Chart segment fill for a status tone — same hue as badge dot. */
export function statusToneChartHex(tone: StatusTone): string {
  return STATUS_TONE_HEX[tone];
}

/** Icon / avatar wrap for connected, verified, or status glyphs. */
export function toneIconWrapClasses(
  tone: StatusTone,
  shape: 'rounded-lg' | 'rounded-full' = 'rounded-lg'
): string {
  const surface = statusToneSurfaceClasses(tone);
  return `flex shrink-0 items-center justify-center ${shape} ${surface.bgColor} ${surface.color}`;
}

export function flagIconChipClasses(kind: 'parking' | 'pet' | 'decor' | 'invalidReceipt'): string {
  const toneMap = {
    parking: 'blue',
    pet: 'amber',
    decor: 'purple',
    invalidReceipt: 'red',
  } as const satisfies Record<typeof kind, StatusTone>;
  return `inline-flex items-center justify-center rounded-md border px-1 py-0.5 ${STATUS_TONE_STYLES[toneMap[kind]].badge}`;
}

export function flagLabelChipClasses(kind: 'parking' | 'pet' | 'decor'): string {
  const toneMap = { parking: 'blue', pet: 'amber', decor: 'purple' } as const;
  return `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold normal-case ${STATUS_TONE_STYLES[toneMap[kind]].badge}`;
}

export function listingStatusBadgeClasses(active: boolean): string {
  const style = active ? LISTING_STATUS_STYLES.ACTIVE : LISTING_STATUS_STYLES.INACTIVE;
  return `inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.badge}`;
}

export function listingStatusDotClasses(active: boolean): string {
  const style = active ? LISTING_STATUS_STYLES.ACTIVE : LISTING_STATUS_STYLES.INACTIVE;
  return `size-1.5 rounded-full ${style.dot}`;
}

/** Marketing / super-admin development type chips. */
export const DEVELOPMENT_TYPE_BADGE: Record<
  'CONDOMINIUM' | 'SUBDIVISION' | 'MIXED_USE' | 'TOWNHOUSE' | 'COMMERCIAL',
  string
> = {
  CONDOMINIUM: toneBadgeClasses('blue'),
  SUBDIVISION: toneBadgeClasses('green'),
  MIXED_USE: toneBadgeClasses('purple'),
  TOWNHOUSE: toneBadgeClasses('amber'),
  COMMERCIAL: toneBadgeClasses('red'),
};
