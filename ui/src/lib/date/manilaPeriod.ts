export function manilaDateParts(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? '2026');
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
  return { y, m, d };
}

export function isoFromManilaParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function manilaTodayIso(): string {
  const { y, m, d } = manilaDateParts();
  return isoFromManilaParts(y, m, d);
}

export type ManilaRangePreset = 'this_month' | 'last_month' | 'ytd' | 'all';

export function manilaRangeForPreset(preset: ManilaRangePreset): {
  from: string | null;
  to: string | null;
} {
  const { y, m, d } = manilaDateParts();
  if (preset === 'all') return { from: null, to: null };
  if (preset === 'this_month') {
    const lastDay = new Date(y, m, 0).getDate();
    return {
      from: isoFromManilaParts(y, m, 1),
      to: isoFromManilaParts(y, m, lastDay),
    };
  }
  if (preset === 'last_month') {
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const lastDay = new Date(prevY, prevM, 0).getDate();
    return {
      from: isoFromManilaParts(prevY, prevM, 1),
      to: isoFromManilaParts(prevY, prevM, lastDay),
    };
  }
  return { from: isoFromManilaParts(y, 1, 1), to: isoFromManilaParts(y, m, d) };
}

export function detectManilaRangePreset(
  from: string | null,
  to: string | null
): ManilaRangePreset | 'custom' {
  for (const preset of ['this_month', 'last_month', 'ytd', 'all'] as const) {
    const r = manilaRangeForPreset(preset);
    if (r.from === from && r.to === to) return preset;
  }
  return 'custom';
}
