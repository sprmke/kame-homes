/**
 * Server-hydrated visual ChatBlocks. The model may emit a `visual` hint; numeric charts,
 * calendars, KPIs, and comparisons are always built here from this turn's tool results.
 */

import {
  holidaysInWindow,
  unpricedHolidayNames,
  type HolidayRuleRange,
} from './dashboardAssistantBriefingExtras.ts';

export type VisualKind = 'chart' | 'calendar' | 'timeline' | 'kpi' | 'comparison';

export type VisualHint = {
  type: 'visual';
  kind: VisualKind;
  source?: string;
};

export type ChartPoint = { x: string; y: number; label?: string };
export type ChartSeries = { name: string; points: ChartPoint[] };

export type ChartBlock = {
  type: 'chart';
  title: string;
  kind: 'bar' | 'line' | 'area' | 'pie' | 'donut';
  series: ChartSeries[];
  unit?: 'php' | 'pct' | 'count';
  xLabel?: string;
  yLabel?: string;
  tableAlt: { columns: string[]; rows: Array<Record<string, string | number>> };
  hydrated: true;
};

export type CalendarDayState = 'booked' | 'blocked' | 'available' | 'checkin' | 'checkout';

export type CalendarBlock = {
  type: 'calendar';
  title: string;
  month: string;
  days: Array<{ date: string; state: CalendarDayState; rate?: string; label?: string }>;
  legend: Array<{ state: string; label: string }>;
  range?: { start: string; end: string };
  hydrated: true;
};

export type TimelineBlock = {
  type: 'timeline';
  title: string;
  items: Array<{
    at: string;
    label: string;
    detail?: string;
    status?: string;
    actor?: string;
    href?: string;
  }>;
  hydrated: true;
};

export type EntityCardBlock = {
  type: 'entity_card';
  entityType:
    | 'property'
    | 'parking'
    | 'team_member'
    | 'maintenance_item'
    | 'inbox_thread'
    | 'support_ticket'
    | 'marketing_template'
    | 'guest';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: { label: string; tone: string };
  facts: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; prompt?: string; routeKey?: string }>;
  hydrated: true;
};

export type CarouselBlock = {
  type: 'carousel';
  title: string;
  items: EntityCardBlock[];
  hydrated: true;
};

export type KpiBlock = {
  type: 'kpi';
  label: string;
  value: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; label?: string };
  sparkline?: number[];
  hydrated: true;
};

export type ComparisonBlock = {
  type: 'comparison';
  title: string;
  columns: [string, string];
  rows: Array<{ label: string; before: string; after: string; changed: boolean }>;
  hydrated: true;
};

export type ChecklistBlock = {
  type: 'checklist';
  title: string;
  items: Array<{ id: string; label: string; done: boolean; prompt?: string }>;
  hydrated: true;
};

export type CalloutBlock = {
  type: 'callout';
  tone: 'info' | 'warning' | 'success';
  text: string;
  href?: string;
};

export type VisualChatBlock =
  | ChartBlock
  | CalendarBlock
  | TimelineBlock
  | EntityCardBlock
  | CarouselBlock
  | KpiBlock
  | ComparisonBlock
  | ChecklistBlock
  | CalloutBlock;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function php(value: unknown): string {
  const text = asText(value);
  if (text.includes('₱')) return text;
  const n = asNumber(value);
  if (n == null) return text;
  return `₱${Math.round(n).toLocaleString('en-US')}`;
}

function recordsFrom(toolResults: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of toolResults) {
    if (Array.isArray(raw)) {
      out.push({ __list: raw });
      continue;
    }
    const rec = asRecord(raw);
    if (!rec) continue;
    out.push(rec);
    const nested = asRecord(rec.data);
    if (nested) out.push(nested);
    if (Array.isArray(rec.data)) out.push({ __list: rec.data });
  }
  return out;
}

function manilaTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function manilaYearMonth(): string {
  return manilaTodayYmd().slice(0, 7);
}

function permissionRefusalText(toolResults: unknown[]): string | null {
  for (const raw of toolResults) {
    if (typeof raw === 'string' && /permission|not allowed|access restricted/i.test(raw)) {
      return raw.trim().slice(0, 200);
    }
    const rec = asRecord(raw);
    const error = asText(rec?.error);
    if (error && /permission|not allowed|access restricted/i.test(error)) {
      return error.slice(0, 200);
    }
  }
  return null;
}

function activityRows(data: unknown): Record<string, unknown>[] {
  const rec = asRecord(data);
  if (Array.isArray(data)) {
    return data
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }
  return listFrom(rec ?? {}, ['entries', 'items', 'events', '__list']);
}

function listFrom(record: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item));
    }
  }
  if (Array.isArray(record.__list)) {
    return (record.__list as unknown[])
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }
  return [];
}

function ymd(value: unknown): string {
  const text = asText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const m = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  return text.slice(0, 10);
}

function eachDate(from: string, to: string): string[] {
  const start = ymd(from);
  const end = ymd(to);
  if (!start || !end) return [];
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return [];
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function monthFromDates(dates: string[]): string {
  const first = dates[0] ?? '';
  return first.slice(0, 7);
}

function shortWhen(value: unknown): string {
  const text = asText(value);
  const day = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!day) return text.slice(0, 12);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[Number(day[2]) - 1] ?? day[2];
  return `${month} ${Number(day[3])}`;
}

export function tableFromActivityLog(data: unknown): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const entries = activityRows(data);
  if (entries.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Recent changes',
    columns: ['When', 'Who', 'What'],
    rows: entries.slice(0, 8).map((row) => ({
      When: shortWhen(row.at ?? row.createdAt),
      Who: asText(row.actorName ?? row.who ?? row.actor) || 'System',
      What: asText(row.summary ?? row.what ?? row.hostLabel ?? row.action),
    })),
    hydrated: true,
  };
}

export function tableFromUnpricedHolidays(
  data: unknown,
  today = manilaTodayYmd()
): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  if (!rec || !Array.isArray(rec.holidayRules)) return null;
  const rules: HolidayRuleRange[] = listFrom(rec, ['holidayRules'])
    .map((row) => ({
      startDate: ymd(row.startDate),
      endDate: ymd(row.endDate || row.startDate),
    }))
    .filter((row) => row.startDate && row.endDate);
  const upcoming = holidaysInWindow(today, 60);
  const uncoveredNames = new Set(unpricedHolidayNames(upcoming, rules));
  const rows = upcoming
    .filter((holiday) => uncoveredNames.has(holiday.name))
    .map((holiday) => ({
      Holiday: holiday.name,
      Dates:
        holiday.startDate === holiday.endDate
          ? holiday.startDate
          : `${holiday.startDate} to ${holiday.endDate}`,
    }));
  if (rows.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Holidays without a rate rule',
    columns: ['Holiday', 'Dates'],
    rows,
    hydrated: true,
  };
}

export function tableFromPortfolioListings(data: unknown): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const listings = rec ? listFrom(rec, ['listings']) : [];
  if (listings.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Listings',
    columns: ['Listing', 'Revenue', 'Occupancy'],
    rows: listings.map((row) => ({
      Listing: asText(row.hostLabel ?? row.name),
      Revenue: php(row.grossRevenueDisplay ?? row.grossRevenue),
      Occupancy: row.occupancyRatePct != null ? `${asText(row.occupancyRatePct)}%` : '',
    })),
    hydrated: true,
  };
}

export function tableFromMarketingTemplates(data: unknown): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const templates = rec
    ? listFrom(rec, ['templates', '__list'])
    : Array.isArray(data)
      ? (data as unknown[])
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
  if (templates.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Templates',
    columns: ['Name', 'Platform', 'Type'],
    rows: templates.slice(0, 12).map((row) => ({
      Name: asText(row.name) || asText(row.hostLabel).split(' · ')[0] || 'Template',
      Platform: asText(row.platform ?? row.contentPlatform),
      Type: asText(row.contentType ?? row.type),
    })),
    hydrated: true,
  };
}

export function statListFromAnalytics(data: unknown): {
  type: 'stat_list';
  title: string;
  items: Array<{ label: string; value: string }>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const kpis = asRecord(rec?.kpis);
  if (!kpis) return null;
  const items = [
    kpis.occupancyRatePct != null
      ? { label: 'Occupancy', value: `${asText(kpis.occupancyRatePct)}%` }
      : null,
    kpis.adrDisplay ? { label: 'ADR', value: asText(kpis.adrDisplay) } : null,
    kpis.revparDisplay ? { label: 'RevPAR', value: asText(kpis.revparDisplay) } : null,
    kpis.reservations != null ? { label: 'Reservations', value: asText(kpis.reservations) } : null,
  ];
  const bench = asRecord(rec?.benchmark);
  if (bench?.available) {
    items.push(
      bench.occupancyPercentile != null
        ? { label: 'Occupancy percentile', value: `${asText(bench.occupancyPercentile)}` }
        : null,
      bench.medianAdrDisplay ? { label: 'Median ADR', value: asText(bench.medianAdrDisplay) } : null
    );
  }
  const filtered = items.filter((item): item is { label: string; value: string } => Boolean(item));
  if (filtered.length === 0) return null;
  return { type: 'stat_list', title: 'Last 30 days', items: filtered, hydrated: true };
}

export function tableFromInboxThreads(data: unknown): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const threads = rec
    ? listFrom(rec, ['threads', 'conversations', '__list'])
    : Array.isArray(data)
      ? (data as unknown[])
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
  if (threads.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Waiting for a reply',
    columns: ['Guest', 'Channel', 'Last message'],
    rows: threads.slice(0, 8).map((row) => ({
      Guest: asText(row.participantName) || asText(row.hostLabel).split(' · ')[0] || 'Guest',
      Channel: asText(row.platform),
      'Last message': asText(row.subjectPreview ?? row.lastMessage),
    })),
    hydrated: true,
  };
}

export function tableFromTeamMembers(data: unknown): {
  type: 'data_table';
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const members = rec
    ? listFrom(rec, ['members', 'team', '__list'])
    : Array.isArray(data)
      ? (data as unknown[])
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [];
  if (members.length === 0) return null;
  return {
    type: 'data_table',
    title: 'Team',
    columns: ['Name', 'Role', 'Status'],
    rows: members.slice(0, 12).map((row) => ({
      Name: asText(row.name ?? row.hostLabel) || 'Member',
      Role: asText(row.role) || 'Team',
      Status: asText(row.status) || 'active',
    })),
    hydrated: true,
  };
}

export function chartFromFinanceSummary(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  const operating = asRecord(rec?.operating);
  const display = asRecord(rec?.display);
  const categories = listFrom(operating ?? {}, ['byCategory']);
  if (categories.length > 0) {
    const points: ChartPoint[] = categories.map((row) => ({
      x: asText(row.label ?? row.category) || 'Other',
      y: asNumber(row.amount) ?? 0,
      label: php(row.amount),
    }));
    return {
      type: 'chart',
      title: 'Expenses',
      kind: 'donut',
      unit: 'php',
      series: [{ name: 'Expenses', points }],
      tableAlt: {
        columns: ['Category', 'Amount'],
        rows: points.map((point) => ({
          Category: point.x,
          Amount: point.label ?? String(point.y),
        })),
      },
      hydrated: true,
    };
  }
  const income = asNumber(display?.totalIncome ?? rec?.totalIncome ?? operating?.income);
  const expenses = asNumber(display?.totalExpenses ?? rec?.totalExpenses ?? operating?.expenses);
  if (income == null && expenses == null) return null;
  const points: ChartPoint[] = [
    { x: 'Income', y: income ?? 0, label: php(income ?? 0) },
    { x: 'Expenses', y: expenses ?? 0, label: php(expenses ?? 0) },
  ];
  return {
    type: 'chart',
    title: 'Income vs expenses',
    kind: 'donut',
    unit: 'php',
    series: [{ name: 'Finance', points }],
    tableAlt: {
      columns: ['Item', 'Amount'],
      rows: points.map((point) => ({
        Item: point.x,
        Amount: point.label ?? String(point.y),
      })),
    },
    hydrated: true,
  };
}

export function chartFromOccupancyTrend(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  const months = listFrom(rec ?? {}, ['trend']);
  const points: ChartPoint[] = [];
  for (const row of months) {
    const y = asNumber(row.occupancyRatePct ?? row.occupancyRate);
    if (y == null) continue;
    const x = asText(row.month ?? row.bucketStart ?? row.label);
    if (!x) continue;
    points.push({ x, y });
  }
  if (points.length < 2) return null;
  if (points.every((point) => point.y === 0)) return null;
  return {
    type: 'chart',
    title: 'Occupancy trend',
    kind: 'line',
    unit: 'pct',
    xLabel: 'Month',
    yLabel: 'Occupancy',
    series: [{ name: 'Occupancy', points }],
    tableAlt: {
      columns: ['Month', 'Occupancy'],
      rows: points.map((point) => ({ Month: point.x, Occupancy: `${point.y}%` })),
    },
    hydrated: true,
  };
}

export function chartFromFinanceTrend(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  const months = listFrom(rec ?? {}, ['months']);
  const trend = months.length >= 2 ? months : listFrom(rec ?? {}, ['trend']);
  const withIncome = trend.filter(
    (row) => asNumber(row.income ?? row.revenue ?? row.grossRevenue) != null
  );
  if (withIncome.length < 2) return null;
  const incomePoints: ChartPoint[] = withIncome.map((row) => ({
    x: asText(row.label ?? row.month),
    y: asNumber(row.income ?? row.revenue ?? row.grossRevenue) ?? 0,
    label: php(row.income ?? row.revenue ?? row.grossRevenue),
  }));
  const expensePoints: ChartPoint[] = withIncome
    .filter((row) => asNumber(row.expenses) != null)
    .map((row) => ({
      x: asText(row.label ?? row.month),
      y: asNumber(row.expenses) ?? 0,
      label: php(row.expenses),
    }));
  const withExpenses = expensePoints.length === incomePoints.length;
  const series: ChartSeries[] = withExpenses
    ? [
        { name: 'Income', points: incomePoints },
        { name: 'Expenses', points: expensePoints },
      ]
    : [{ name: 'Income', points: incomePoints }];
  const rows: Array<Record<string, string | number>> = withExpenses
    ? incomePoints.map((point, index) => ({
        Month: point.x,
        Income: point.label ?? String(point.y),
        Expenses: expensePoints[index]?.label ?? String(expensePoints[index]?.y ?? ''),
      }))
    : incomePoints.map((point) => ({
        Month: point.x,
        Income: point.label ?? String(point.y),
      }));
  return {
    type: 'chart',
    title: withExpenses ? 'Income vs expenses' : 'Income trend',
    kind: 'line',
    unit: 'php',
    xLabel: 'Month',
    yLabel: 'PHP',
    series,
    tableAlt: {
      columns: withExpenses ? ['Month', 'Income', 'Expenses'] : ['Month', 'Income'],
      rows,
    },
    hydrated: true,
  };
}

export function chartFromPortfolioAnalytics(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  const listings = listFrom(rec ?? {}, ['listings']);
  if (listings.length === 0) return null;
  const points: ChartPoint[] = listings.map((row) => ({
    x: asText(row.hostLabel ?? row.name),
    y: asNumber(row.grossRevenue) ?? 0,
    label: php(row.grossRevenueDisplay ?? row.grossRevenue),
  }));
  return {
    type: 'chart',
    title: 'Revenue by listing',
    kind: 'bar',
    unit: 'php',
    series: [{ name: 'Revenue', points }],
    tableAlt: {
      columns: ['Listing', 'Revenue'],
      rows: points.map((point) => ({
        Listing: point.x,
        Revenue: point.label ?? String(point.y),
      })),
    },
    hydrated: true,
  };
}

export function chartFromPropertyAnalytics(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  const mix = listFrom(rec ?? {}, ['channelMix']);
  if (mix.length === 0) return null;
  const points: ChartPoint[] = mix.map((row) => ({
    x: asText(row.channel),
    y: asNumber(row.count) ?? 0,
  }));
  return {
    type: 'chart',
    title: 'Channel mix',
    kind: 'donut',
    unit: 'count',
    series: [{ name: 'Bookings', points }],
    tableAlt: {
      columns: ['Channel', 'Bookings'],
      rows: points.map((point) => ({ Channel: point.x, Bookings: point.y })),
    },
    hydrated: true,
  };
}

export function chartFromSmartPricingPreview(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const changeKey = Array.isArray(rec.changes)
    ? 'changes'
    : Array.isArray(rec.firstChanges)
      ? 'firstChanges'
      : null;
  if (!changeKey) return null;
  const changes = listFrom(rec, [changeKey]);
  if (changes.length === 0) return null;
  return {
    type: 'chart',
    title: 'Proposed rates',
    kind: 'line',
    unit: 'php',
    series: [
      {
        name: 'Current',
        points: changes.map((row) => ({
          x: ymd(row.date),
          y: asNumber(row.current) ?? 0,
        })),
      },
      {
        name: 'Proposed',
        points: changes.map((row) => ({
          x: ymd(row.date),
          y: asNumber(row.proposed ?? row.recommended) ?? 0,
        })),
      },
    ],
    tableAlt: {
      columns: ['Date', 'Current', 'Proposed'],
      rows: changes.map((row) => ({
        Date: ymd(row.date),
        Current: php(row.current),
        Proposed: php(row.proposed ?? row.recommended),
      })),
    },
    hydrated: true,
  };
}

export function calendarFromAvailability(data: unknown): CalendarBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const from = ymd(rec.from);
  const to = ymd(rec.to);
  if (!from || !to) return null;
  const dates = eachDate(from, to);
  if (dates.length === 0) return null;
  const stays = listFrom(rec, ['bookedStays']);
  const ranges = listFrom(rec, ['availableRanges']);
  const days = dates.map((date) => {
    const stay = stays.find((row) => {
      const checkIn = ymd(row.checkIn);
      const checkOut = ymd(row.checkOut);
      return Boolean(checkIn && checkOut && date >= checkIn && date < checkOut);
    });
    if (stay) {
      const checkIn = ymd(stay.checkIn);
      return {
        date,
        state: (date === checkIn ? 'checkin' : 'booked') as CalendarDayState,
        label: asText(stay.guestName),
      };
    }
    const open = ranges.some((row) => {
      const start = ymd(row.start);
      const end = ymd(row.end);
      return Boolean(start && end && date >= start && date <= end);
    });
    return { date, state: (open ? 'available' : 'booked') as CalendarDayState };
  });
  const openNights =
    asNumber(rec.availableNightCount) ?? days.filter((day) => day.state === 'available').length;
  const baseTitle = asText(rec.propertyName)
    ? `${asText(rec.propertyName)} availability`
    : 'Availability';
  const rangeBits = ranges
    .map((row) => {
      const start = shortWhen(row.start);
      const end = shortWhen(row.end);
      if (!start || !end) return '';
      const startDay = start.replace(/^([A-Za-z]+)\s+/, '');
      const endDay = end.replace(/^([A-Za-z]+)\s+/, '');
      const month = start.replace(/\s+\d+$/, '');
      return start === end ? start : `${month} ${startDay}-${endDay}`;
    })
    .filter(Boolean);
  const rangeTitle = rangeBits.length ? ` · ${rangeBits.join(' and ')}` : '';
  return {
    type: 'calendar',
    title: `${baseTitle} · ${openNights} open nights${rangeTitle}`,
    month: monthFromDates(dates),
    days,
    legend: [
      { state: 'available', label: 'Open' },
      { state: 'booked', label: 'Booked' },
      { state: 'checkin', label: 'Check-in' },
    ],
    range: { start: from, end: to },
    hydrated: true,
  };
}

export function calendarFromPricing(data: unknown): CalendarBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const overrides = asRecord(rec.dateOverrides) ?? {};
  const blocked = Array.isArray(rec.blockedDateKeys)
    ? rec.blockedDateKeys.map((key) => ymd(key)).filter(Boolean)
    : [];
  const overrideDates = Object.keys(overrides).map(ymd).filter(Boolean);
  const all = [...overrideDates, ...blocked].sort();
  const weekday = asNumber(rec.weekdayNightlyRate);
  const weekend = asNumber(rec.weekendNightlyRate);
  if (all.length === 0 && weekday == null && weekend == null) return null;
  const month = all[0]?.slice(0, 7) || manilaYearMonth();
  const from = `${month}-01`;
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  const to = lastDay.toISOString().slice(0, 10);
  const days = eachDate(from, to).map((date) => {
    if (blocked.includes(date)) return { date, state: 'blocked' as const };
    const override = overrides[date] ?? overrides[date.replace(/-/g, '')];
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const rate = override != null ? php(override) : php(isWeekend ? weekend : weekday);
    return { date, state: 'available' as const, rate };
  });
  return {
    type: 'calendar',
    title: 'Rates',
    month,
    days,
    legend: [
      { state: 'available', label: 'Open' },
      { state: 'blocked', label: 'Blocked' },
    ],
    hydrated: true,
  };
}

export function calloutFromEmptyActivity(data: unknown): CalloutBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const keyed =
    Array.isArray(rec.events) || Array.isArray(rec.entries) || Array.isArray(rec.__list);
  if (!keyed) return null;
  if (activityRows(data).length > 0) return null;
  return { type: 'callout', tone: 'info', text: 'No changes in that window.' };
}

export function timelineFromMaintenance(data: unknown): TimelineBlock | null {
  const rec = asRecord(data);
  const rows = Array.isArray(data)
    ? data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : listFrom(rec ?? {}, ['items', '__list']);
  const done = rows.filter((row) => row.completedAt);
  if (done.length === 0) return null;
  return {
    type: 'timeline',
    title: 'Completed maintenance',
    items: done.map((row) => ({
      at: asText(row.completedAt),
      label: asText(row.label ?? row.hostLabel),
      detail: asText(row.category ?? row.notes),
    })),
    hydrated: true,
  };
}

export function comparisonFromFinanceTrendQuarters(data: unknown): ComparisonBlock | null {
  const rec = asRecord(data);
  const months = listFrom(rec ?? {}, ['months']);
  const trend = months.length > 0 ? months : listFrom(rec ?? {}, ['trend']);
  const totals = new Map<string, number>();
  for (const row of trend) {
    const stamp = asText(row.month ?? row.period ?? row.label);
    const ym = stamp.match(/^(\d{4})-(\d{2})/);
    if (!ym) continue;
    const quarter = `${ym[1]}-Q${Math.ceil(Number(ym[2]) / 3)}`;
    const net =
      asNumber(row.netProfit) ??
      (asNumber(row.income ?? row.revenue) ?? 0) - (asNumber(row.expenses) ?? 0);
    totals.set(quarter, (totals.get(quarter) ?? 0) + net);
  }
  const keys = [...totals.keys()].sort();
  if (keys.length < 2) return null;
  const prior = keys[keys.length - 2];
  const last = keys[keys.length - 1];
  const priorNet = totals.get(prior) ?? 0;
  const lastNet = totals.get(last) ?? 0;
  return {
    type: 'comparison',
    title: 'Net profit',
    columns: [last, prior],
    rows: [
      {
        label: 'Net profit',
        before: php(lastNet),
        after: php(priorNet),
        changed: lastNet !== priorNet,
      },
    ],
    hydrated: true,
  };
}

export function comparisonFromFinancePeriods(
  records: Record<string, unknown>[]
): ComparisonBlock | null {
  const summaries = records.filter(
    (rec) => rec.netProfit != null || asRecord(rec.display)?.netProfit != null
  );
  if (summaries.length < 2) return null;
  const [first, second] = summaries;
  const labelFor = (rec: Record<string, unknown>, fallback: string) => {
    const period = asRecord(rec.period);
    const from = asText(period?.from);
    return from ? from.slice(0, 7) : fallback;
  };
  return {
    type: 'comparison',
    title: 'Net profit',
    columns: [labelFor(first, 'Last period'), labelFor(second, 'Prior period')],
    rows: [
      {
        label: 'Net profit',
        before: php(asRecord(first.display)?.netProfit ?? first.netProfit),
        after: php(asRecord(second.display)?.netProfit ?? second.netProfit),
        changed: true,
      },
    ],
    hydrated: true,
  };
}

export function timelineFromActivityLog(data: unknown): TimelineBlock | null {
  const entries = activityRows(data);
  if (entries.length === 0) return null;
  return {
    type: 'timeline',
    title: 'Activity',
    items: entries.map((row) => ({
      at: asText(row.at ?? row.createdAt),
      label: asText(row.hostLabel ?? row.summary ?? row.what ?? row.action),
      detail: asText(row.summary ?? row.what),
      actor: asText(row.actorName ?? row.who),
      status: asText(row.severity),
    })),
    hydrated: true,
  };
}

export function timelineFromBookingHistory(data: unknown): TimelineBlock | null {
  const rec = asRecord(data);
  const history = listFrom(rec ?? {}, ['statusHistory', 'history']);
  if (history.length === 0) return null;
  return {
    type: 'timeline',
    title: 'Booking history',
    items: history.map((row) => ({
      at: asText(row.at ?? row.createdAt),
      label: asText(row.label ?? row.statusLabel ?? row.status ?? row.summary),
      detail: asText(row.detail ?? row.note),
      actor: asText(row.actor ?? row.who ?? row.actorName) || undefined,
    })),
    hydrated: true,
  };
}

export function timelineFromPublishHistory(data: unknown): TimelineBlock | null {
  const rows = Array.isArray(data)
    ? data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : listFrom(asRecord(data) ?? {}, ['history', 'items', '__list']);
  if (rows.length === 0) return null;
  return {
    type: 'timeline',
    title: 'Publish history',
    items: rows.map((row) => ({
      at: asText(row.publishedAt ?? row.at),
      label: [asText(row.platform), asText(row.publishType), asText(row.status)]
        .filter(Boolean)
        .join(' '),
      detail: asText(row.caption ?? row.status),
      status: asText(row.status),
    })),
    hydrated: true,
  };
}

export function kpiFromAnalytics(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const kpis = asRecord(rec?.kpis);
  if (kpis && kpis.occupancyRatePct != null) {
    const vs = asText(kpis.occupancyRateVsPrior);
    const direction: 'up' | 'down' | 'flat' = vs.startsWith('-')
      ? 'down'
      : vs.startsWith('+')
        ? 'up'
        : 'flat';
    const forwardState = asText(asRecord(rec?.state)?.forwardOccupancyState30d);
    return {
      type: 'kpi',
      label: 'Occupancy',
      value: `${asText(kpis.occupancyRatePct)}%`,
      delta: vs
        ? {
            value: vs,
            direction,
            label: forwardState ? `vs last period · 30-day ${forwardState}` : 'vs last period',
          }
        : undefined,
      hydrated: true,
    };
  }
  const display = asRecord(rec?.display);
  if (display?.netProfit || rec?.netProfit != null) {
    return {
      type: 'kpi',
      label: 'Net profit',
      value: php(display?.netProfit ?? rec?.netProfit),
      hydrated: true,
    };
  }
  return null;
}

export function kpiFromFinanceSummary(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const display = asRecord(rec?.display);
  if (display?.netProfit || rec?.netProfit != null) {
    const income = php(display?.totalIncome ?? rec?.totalIncome);
    const expenses = php(display?.totalExpenses ?? rec?.totalExpenses);
    return {
      type: 'kpi',
      label: 'Net profit',
      value: php(display?.netProfit ?? rec?.netProfit),
      delta:
        income.includes('₱') && expenses.includes('₱')
          ? { value: `Income ${income} · expenses ${expenses}`, direction: 'flat' }
          : undefined,
      hydrated: true,
    };
  }
  if (display?.totalIncome || rec?.totalIncome != null) {
    return {
      type: 'kpi',
      label: 'Income',
      value: php(display?.totalIncome ?? rec?.totalIncome),
      hydrated: true,
    };
  }
  return null;
}

export function kpiFromPortfolioTotals(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const totals = asRecord(rec?.totals);
  if (!totals) return null;
  if (totals.grossRevenue == null && totals.grossRevenueDisplay == null) return null;
  return {
    type: 'kpi',
    label: 'Portfolio revenue',
    value: php(totals.grossRevenueDisplay ?? totals.grossRevenue),
    hydrated: true,
  };
}

export function kpiFromForwardOccupancy(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const forward = asRecord(rec?.forward);
  const pct = asNumber(forward?.occupancyOnBooksPct);
  if (pct == null) return null;
  return {
    type: 'kpi',
    label: 'Forward occupancy',
    value: `${pct}%`,
    hydrated: true,
  };
}

export function kpiFromPendingPayments(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const display = asRecord(rec?.display);
  if (display?.pendingPayments == null && rec?.pendingPayments == null) return null;
  return {
    type: 'kpi',
    label: 'Pending',
    value: php(display?.pendingPayments ?? rec?.pendingPayments),
    hydrated: true,
  };
}

export function statListFromFinanceSummary(data: unknown): {
  type: 'stat_list';
  title: string;
  items: Array<{ label: string; value: string }>;
  hydrated: true;
} | null {
  const rec = asRecord(data);
  const display = asRecord(rec?.display);
  if (display?.netProfit == null && rec?.netProfit == null) return null;
  return {
    type: 'stat_list',
    title: 'This period',
    items: [
      { label: 'Total income', value: php(display?.totalIncome ?? rec?.totalIncome) },
      { label: 'Total expenses', value: php(display?.totalExpenses ?? rec?.totalExpenses) },
      { label: 'Net profit', value: php(display?.netProfit ?? rec?.netProfit) },
    ],
    hydrated: true,
  };
}

export function calloutFromMetricExplanation(data: unknown): CalloutBlock | null {
  const rec = asRecord(data);
  const explanation = asText(rec?.explanation);
  if (!explanation || rec?.metric == null) return null;
  return { type: 'callout', tone: 'info', text: explanation };
}

export function kpiFromPlanSnapshot(data: unknown): KpiBlock | null {
  const rec = asRecord(data);
  const quota = asRecord(rec?.assistantQuota);
  const remaining = asNumber(quota?.messagesRemainingToday);
  const limit = asNumber(quota?.dailyMessageLimit);
  if (remaining == null || limit == null) return null;
  return {
    type: 'kpi',
    label: 'AI messages left today',
    value: String(remaining),
    delta: { value: `of ${limit}`, direction: 'flat' },
    hydrated: true,
  };
}

export function comparisonFromWeekdayWeekend(data: unknown): ComparisonBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const weekday = asNumber(rec.weekdayNightlyRate);
  const weekend = asNumber(rec.weekendNightlyRate);
  if (weekday == null || weekend == null) return null;
  return {
    type: 'comparison',
    title: 'Weekday vs weekend',
    columns: ['Weekday', 'Weekend'],
    rows: [
      {
        label: 'Nightly rate',
        before: php(weekday),
        after: php(weekend),
        changed: weekday !== weekend,
      },
    ],
    hydrated: true,
  };
}

export function comparisonFromProposalPayload(data: unknown): ComparisonBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const next30 = asRecord(rec.next30);
  if (next30) {
    const proposedTotal = next30.proposedTotalDisplay ?? next30.proposedTotal ?? next30.smartTotal;
    const currentTotal = next30.currentTotalDisplay ?? next30.currentTotal;
    const changeRows = Array.isArray(rec.firstChanges)
      ? listFrom(rec, ['firstChanges'])
      : Array.isArray(rec.changes)
        ? listFrom(rec, ['changes'])
        : [];
    const rows: ComparisonBlock['rows'] = [
      {
        label: 'Next 30 days',
        before: php(currentTotal),
        after: php(proposedTotal),
        changed: asNumber(currentTotal) !== asNumber(proposedTotal),
      },
      ...changeRows.map((row) => {
        const proposed = row.proposed ?? row.recommended;
        return {
          label: ymd(row.date),
          before: php(row.current),
          after: php(proposed),
          changed: asNumber(row.current) !== asNumber(proposed),
        };
      }),
    ];
    const changedNights = asNumber(next30.changedNights);
    return {
      type: 'comparison',
      title: changedNights != null ? `Smart Pricing · ${changedNights} nights` : 'Smart Pricing',
      columns: ['Current', 'Proposed'],
      rows,
      hydrated: true,
    };
  }
  const current = asRecord(rec.current);
  const proposed = asRecord(rec.proposed) ?? asRecord(rec.patch);
  if (current && proposed) {
    const keys = [...new Set([...Object.keys(current), ...Object.keys(proposed)])];
    const rows = keys
      .map((key) => {
        const before = typeof current[key] === 'number' ? php(current[key]) : asText(current[key]);
        const after =
          typeof proposed[key] === 'number' ? php(proposed[key]) : asText(proposed[key]);
        if (!before && !after) return null;
        return {
          label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '),
          before,
          after,
          changed: before !== after,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (rows.length > 0) {
      return {
        type: 'comparison',
        title: asText(rec.title) || 'Changes',
        columns: ['Current', 'Proposed'],
        rows,
        hydrated: true,
      };
    }
  }
  const listings = listFrom(rec, ['listings']).filter(
    (row) =>
      asText(row.hostLabel ?? row.name) &&
      (row.grossRevenue != null || row.grossRevenueDisplay != null)
  );
  if (listings.length >= 2) {
    return {
      type: 'comparison',
      title: 'Listings',
      columns: ['Revenue', 'Occupancy'],
      rows: listings.map((row) => ({
        label: asText(row.hostLabel ?? row.name),
        before: php(row.grossRevenueDisplay ?? row.grossRevenue),
        after: row.occupancyRatePct != null ? `${asText(row.occupancyRatePct)}%` : '',
        changed: true,
      })),
      hydrated: true,
    };
  }
  return null;
}

export function comparisonFromListings(data: unknown): ComparisonBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const listings = listFrom(rec, ['listings']).filter(
    (row) =>
      asText(row.hostLabel ?? row.name) &&
      (row.grossRevenue != null || row.grossRevenueDisplay != null)
  );
  if (listings.length === 0) return null;
  const sorted = [...listings].sort(
    (a, b) =>
      (asNumber(b.grossRevenue ?? b.grossRevenueDisplay) ?? 0) -
      (asNumber(a.grossRevenue ?? a.grossRevenueDisplay) ?? 0)
  );
  return {
    type: 'comparison',
    title: 'Revenue by listing',
    columns: ['Revenue', 'Occupancy'],
    rows: sorted.map((row) => ({
      label: asText(row.hostLabel ?? row.name),
      before: php(row.grossRevenueDisplay ?? row.grossRevenue),
      after: row.occupancyRatePct != null ? `${asText(row.occupancyRatePct)}%` : '',
      changed: true,
    })),
    hydrated: true,
  };
}

export function comparisonFromBenchmark(data: unknown): ComparisonBlock | null {
  const rec = asRecord(data);
  const kpis = asRecord(rec?.kpis);
  const bench = asRecord(rec?.benchmark);
  if (!kpis || !bench || bench.available === false) return null;
  const occ = asNumber(kpis.occupancyRatePct);
  const medianOcc = asNumber(bench.medianOccupancyRatePct ?? bench.medianOccupancyRate);
  const adr = asText(kpis.adrDisplay) || (asNumber(kpis.adr) != null ? php(kpis.adr) : '');
  const medianAdr =
    asText(bench.medianAdrDisplay) ||
    (asNumber(bench.medianAdr) != null ? php(bench.medianAdr) : '');
  const rows: ComparisonBlock['rows'] = [];
  if (occ != null && medianOcc != null) {
    rows.push({
      label: 'Occupancy',
      before: `${occ}%`,
      after: `${medianOcc}%`,
      changed: occ !== medianOcc,
    });
  }
  if (adr && medianAdr) {
    rows.push({
      label: 'ADR',
      before: adr,
      after: medianAdr,
      changed: adr !== medianAdr,
    });
  }
  if (rows.length === 0) return null;
  return {
    type: 'comparison',
    title: 'This listing vs Kame median',
    columns: ['This listing', 'Median'],
    rows,
    hydrated: true,
  };
}

export function chartFromDemographics(data: unknown): ChartBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const party = listFrom(rec, ['partySize']);
  const lead = listFrom(rec, ['leadTimeBands', 'leadTime']);
  const source = party.length > 0 ? party : lead;
  if (source.length === 0) return null;
  const points: ChartPoint[] = source.map((row) => ({
    x: asText(row.label ?? row.bucket),
    y: asNumber(row.count) ?? 0,
  }));
  return {
    type: 'chart',
    title: party.length > 0 ? 'Party size' : 'Lead time',
    kind: 'donut',
    unit: 'count',
    series: [{ name: 'Guests', points }],
    tableAlt: {
      columns: ['Group', 'Count'],
      rows: [
        ...party.map((row) => ({
          Group: asText(row.label ?? row.bucket),
          Count: asNumber(row.count) ?? 0,
        })),
        ...lead.map((row) => ({
          Group: asText(row.label ?? row.bucket),
          Count: asNumber(row.count) ?? 0,
        })),
      ],
    },
    hydrated: true,
  };
}

export function checklistFromSetupGuide(data: unknown): ChecklistBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const steps = listFrom(rec, ['steps']).filter((row) => asText(row.label) && 'done' in row);
  if (steps.length === 0) return null;
  return {
    type: 'checklist',
    title: 'Setup guide',
    items: steps.map((row) => ({
      id: asText(row.id) || asText(row.label),
      label: asText(row.label),
      done: Boolean(row.done),
      prompt: row.done ? undefined : `Open ${asText(row.label)}`,
    })),
    hydrated: true,
  };
}

export function checklistFromSuperhost(data: unknown): ChecklistBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const criteria = listFrom(rec, ['criteria']).filter((row) => asText(row.label) && 'met' in row);
  if (criteria.length === 0) return null;
  return {
    type: 'checklist',
    title: asText(rec.tierLabel) || 'Superhost',
    items: criteria.map((row) => ({
      id: asText(row.id) || asText(row.label),
      label: [asText(row.label), asText(row.current)].filter(Boolean).join(' · '),
      done: Boolean(row.met),
    })),
    hydrated: true,
  };
}

export function checklistFromAttention(data: unknown): ChecklistBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const rows = listFrom(rec, ['attention']).filter((row) => (asNumber(row.count) ?? 0) > 0);
  if (rows.length === 0) return null;
  return {
    type: 'checklist',
    title: 'Needs attention',
    items: rows.slice(0, 8).map((row) => ({
      id: asText(row.id) || asText(row.label),
      label: `${asNumber(row.count) ?? 0} ${asText(row.label)}`.trim(),
      done: false,
      prompt: asText(row.label) ? `Show ${asText(row.label).toLowerCase()}` : undefined,
    })),
    hydrated: true,
  };
}

export function checklistFromPendingTasks(data: unknown): ChecklistBlock | null {
  const rec = asRecord(data);
  if (!rec) return null;
  if (Array.isArray(rec.pendingTasks) && rec.pendingTasks.length > 0) {
    return {
      type: 'checklist',
      title: 'Pending tasks',
      items: rec.pendingTasks.map((task, index) => ({
        id: `task-${index}`,
        label: asText(task),
        done: false,
      })),
      hydrated: true,
    };
  }
  const items = Array.isArray(rec.__list)
    ? listFrom(rec, ['__list'])
    : listFrom(rec, ['items', 'steps']);
  const open = items.filter((row) => !row.completedAt && row.done !== true);
  const source = items.some((row) => 'completedAt' in row || 'label' in row) ? items : [];
  if (source.length === 0 && open.length === 0) return null;
  const rows = source.length ? source.filter((row) => !row.completedAt) : open;
  if (rows.length === 0) return null;
  return {
    type: 'checklist',
    title: 'Open maintenance',
    items: rows.map((row) => ({
      id: asText(row.id) || asText(row.label),
      label: [asText(row.label ?? row.hostLabel), asText(row.scheduledOn)]
        .filter(Boolean)
        .join(' · '),
      done: Boolean(row.completedAt),
      prompt: asText(row.label) ? `Show ${asText(row.label)}` : undefined,
    })),
    hydrated: true,
  };
}

export function checklistFromPlaybook(data: unknown): ChecklistBlock | null {
  const rec = asRecord(data);
  const articles = listFrom(rec ?? {}, ['suggestedPlaybookArticles']).filter((row) =>
    asText(row.title)
  );
  const forwardPct = asNumber(asRecord(rec?.forward)?.occupancyOnBooksPct);
  const items = [
    ...(forwardPct != null
      ? [
          {
            id: 'playbook-forward',
            label: `Forward occupancy ${forwardPct}% on the books`,
            done: false,
          },
        ]
      : []),
    ...articles.slice(0, 4).map((row, index) => ({
      id: `playbook-${index}`,
      label: asText(row.title),
      done: false,
      prompt: `Open playbook: ${asText(row.title)}`,
    })),
  ];
  if (articles.length === 0 && items.length === 0) return null;
  return {
    type: 'checklist',
    title: 'What you can try',
    items,
    hydrated: true,
  };
}

export function entityCardsFromListResult(data: unknown): EntityCardBlock[] {
  const rec = asRecord(data);
  const rows = Array.isArray(data)
    ? data
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
    : listFrom(rec ?? {}, ['items', 'threads', 'conversations', 'templates']);
  if (rows.length === 0 && rec?.conversationId && !Array.isArray(rec.data)) {
    rows.push(rec);
  }
  return rows.slice(0, 8).map((row) => {
    const participant = asText(row.participantName);
    const templateName = asText(row.name);
    const isThread = Boolean(row.conversationId || participant);
    const isTheme = Boolean(row.tokens || (row.source && !row.contentType && !row.platform));
    const isTemplate = Boolean(row.thumbnailUrl || row.contentType || templateName);
    if (isThread) {
      return {
        type: 'entity_card' as const,
        entityType: 'inbox_thread' as const,
        id: asText(row.conversationId ?? row.id),
        title: participant || asText(row.hostLabel) || 'Thread',
        subtitle: asText(row.subjectPreview),
        badge: row.unreadCount
          ? { label: `${asText(row.unreadCount)} unread`, tone: 'warning' }
          : undefined,
        facts: [
          { label: 'Platform', value: asText(row.platform) },
          { label: 'Status', value: asText(row.replyStatus) },
        ].filter((fact) => fact.value),
        hydrated: true as const,
      };
    }
    return {
      type: 'entity_card' as const,
      entityType: (isTemplate || isTheme
        ? 'marketing_template'
        : 'guest') as EntityCardBlock['entityType'],
      id: asText(row.id),
      title: templateName || asText(row.hostLabel) || 'Item',
      subtitle: asText(row.platform ?? row.contentType ?? row.source),
      imageUrl: asText(row.thumbnailUrl) || undefined,
      facts: [
        { label: 'Platform', value: asText(row.platform) },
        { label: 'Type', value: asText(row.contentType) },
        { label: 'Source', value: asText(row.source) },
      ].filter((fact) => fact.value),
      hydrated: true as const,
    };
  });
}

export function carouselFromEntityCards(
  title: string,
  items: EntityCardBlock[]
): CarouselBlock | null {
  if (items.length < 2) return null;
  return { type: 'carousel', title, items: items.slice(0, 8), hydrated: true };
}

function messageHas(message: string, pattern: RegExp): boolean {
  return pattern.test(message);
}

function firstMatching<T>(
  records: Record<string, unknown>[],
  build: (data: unknown) => T | null
): T | null {
  for (const record of records) {
    const built = build(record);
    if (built) return built;
    if (Array.isArray(record.__list)) {
      const fromList = build(record.__list);
      if (fromList) return fromList;
    }
  }
  return null;
}

type InjectedBlock =
  | VisualChatBlock
  | {
      type: 'data_table';
      title: string;
      columns: string[];
      rows: Array<Record<string, string | number>>;
      hydrated: true;
    }
  | {
      type: 'stat_list';
      title: string;
      items: Array<{ label: string; value: string }>;
      hydrated: true;
    };

/** Resolve model `visual` hints and auto-inject visuals from this turn's tool payloads. */
export function hydrateVisualBlocks<T extends { type: string }>(
  blocks: T[],
  toolResults: unknown[],
  userMessage = '',
  rawModelBlocks: unknown[] = []
): Array<T | VisualChatBlock> {
  const records = recordsFrom(toolResults);
  const next: Array<T | VisualChatBlock | InjectedBlock> = [...blocks];
  const hasType = (type: string) => next.some((block) => block.type === type);

  /** Hydrated visuals are the primary data block, not a tail after the model's weaker sibling. */
  const insertPrimary = (block: InjectedBlock | null | undefined, demoteTypes: string[] = []) => {
    if (!block) return;
    for (let i = next.length - 1; i >= 0; i--) {
      if (demoteTypes.includes(next[i].type)) next.splice(i, 1);
    }
    if (block.type === 'entity_card') {
      const id = 'id' in block ? asText(block.id) : '';
      if (
        id &&
        next.some(
          (existing) =>
            existing.type === 'entity_card' && 'id' in existing && asText(existing.id) === id
        )
      ) {
        return;
      }
    } else if (hasType(block.type)) {
      return;
    }
    let index = 0;
    while (index < next.length && next[index].type === 'text') index++;
    next.splice(index, 0, block);
  };

  for (const raw of rawModelBlocks) {
    const rec = asRecord(raw);
    if (rec?.type !== 'visual') continue;
    const kind = asText(rec.kind) as VisualKind;
    if (kind === 'chart') {
      insertPrimary(
        firstMatching(records, chartFromOccupancyTrend) ??
          firstMatching(records, chartFromDemographics) ??
          firstMatching(records, chartFromFinanceTrend) ??
          firstMatching(records, chartFromFinanceSummary) ??
          firstMatching(records, chartFromPropertyAnalytics) ??
          firstMatching(records, chartFromPortfolioAnalytics) ??
          firstMatching(records, chartFromSmartPricingPreview),
        ['diagram', 'stat_list']
      );
    } else if (kind === 'calendar') {
      insertPrimary(
        firstMatching(records, calendarFromAvailability) ??
          firstMatching(records, calendarFromPricing),
        ['stat_list', 'data_table']
      );
    } else if (kind === 'timeline') {
      insertPrimary(
        firstMatching(records, timelineFromActivityLog) ??
          firstMatching(records, timelineFromBookingHistory) ??
          firstMatching(records, timelineFromPublishHistory)
      );
    } else if (kind === 'kpi') {
      insertPrimary(
        firstMatching(records, kpiFromAnalytics) ??
          firstMatching(records, kpiFromFinanceSummary) ??
          firstMatching(records, kpiFromPlanSnapshot),
        ['stat_list']
      );
    } else if (kind === 'comparison') {
      insertPrimary(firstMatching(records, comparisonFromProposalPayload), [
        'stat_list',
        'data_table',
      ]);
    }
  }

  const refusal = permissionRefusalText(toolResults);
  const msg = userMessage;
  if (refusal) {
    insertPrimary({ type: 'callout', tone: 'warning', text: refusal }, [
      'timeline',
      'chart',
      'kpi',
      'data_table',
      'stat_list',
      'calendar',
      'comparison',
      'carousel',
    ]);
  } else if (
    messageHas(
      msg,
      /availab|calendar|blocked date|december rate|rates this month|this month.?rates|next 60 days|next sixty days|rates and blocked|still open|fully open|open nights|which dates|booked next|what's booked|what is booked|is .* free|dec 24|christmas|new year|rates over/i
    )
  ) {
    insertPrimary(
      firstMatching(records, calendarFromAvailability) ??
        firstMatching(records, calendarFromPricing),
      ['stat_list', 'data_table']
    );
  }
  if (
    !refusal &&
    messageHas(
      msg,
      /weekday and weekend|weekday vs weekend|weekend rates|nightly rates|what are my rates/i
    )
  ) {
    insertPrimary(firstMatching(records, comparisonFromWeekdayWeekend), [
      'stat_list',
      'data_table',
    ]);
  }
  if (!refusal && messageHas(msg, /holidays have no rate|unpriced holiday|no rate rule/i)) {
    insertPrimary(firstMatching(records, tableFromUnpricedHolidays), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /occupancy trend|occupancy over|occupancy this year/i)) {
    insertPrimary(
      firstMatching(records, chartFromOccupancyTrend) ?? firstMatching(records, kpiFromAnalytics),
      ['stat_list', 'kpi', 'chart']
    );
  }
  if (
    !refusal &&
    messageHas(msg, /income trend|last 6 months|income rose|going up|going down|up or down/i)
  ) {
    insertPrimary(
      firstMatching(records, chartFromFinanceTrend) ??
        firstMatching(records, chartFromOccupancyTrend),
      ['diagram', 'stat_list', 'chart', 'data_table']
    );
  }
  if (
    !refusal &&
    messageHas(msg, /expense|where did my expenses|break down expenses|revenue vs/i)
  ) {
    insertPrimary(
      firstMatching(records, chartFromFinanceSummary) ??
        firstMatching(records, chartFromFinanceTrend),
      ['diagram', 'stat_list', 'data_table']
    );
  }
  if (!refusal && messageHas(msg, /channel mix|bookings come from/i)) {
    insertPrimary(firstMatching(records, chartFromPropertyAnalytics), ['data_table', 'stat_list']);
  }
  if (
    !refusal &&
    messageHas(msg, /still pending|pending from guests|money is still pending|how much .*pending/i)
  ) {
    insertPrimary(firstMatching(records, kpiFromPendingPayments), ['stat_list', 'chart']);
  }
  if (
    !refusal &&
    !messageHas(msg, /quarter/) &&
    messageHas(
      msg,
      /financially|how did october|net profit|how much profit|profit did i make|how much did i make|made this month/i
    )
  ) {
    insertPrimary(firstMatching(records, statListFromFinanceSummary), [
      'chart',
      'diagram',
      'stat_list',
    ]);
    insertPrimary(firstMatching(records, kpiFromFinanceSummary), ['chart', 'diagram']);
  }
  if (!refusal && messageHas(msg, /occupancy compared|occupancy rate|occupancy\?|adr|revpar/i)) {
    insertPrimary(firstMatching(records, kpiFromAnalytics), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /similar listings|how do i compare|benchmark/i)) {
    insertPrimary(
      firstMatching(records, comparisonFromBenchmark) ??
        firstMatching(records, statListFromAnalytics),
      ['kpi', 'stat_list']
    );
  }
  if (
    !refusal &&
    messageHas(msg, /all my listings|portfolio|earned the most|which property earned/i)
  ) {
    insertPrimary(firstMatching(records, kpiFromPortfolioTotals));
    insertPrimary(
      firstMatching(records, comparisonFromListings) ??
        firstMatching(records, comparisonFromProposalPayload),
      ['stat_list', 'data_table']
    );
  }
  if (!refusal && messageHas(msg, /why is next month|what can i do|playbook/i)) {
    insertPrimary(firstMatching(records, kpiFromForwardOccupancy), ['stat_list']);
    insertPrimary(firstMatching(records, checklistFromPlaybook), ['stat_list']);
  }
  if (
    !refusal &&
    messageHas(msg, /what would smart pricing|run smart pricing|smart pricing would change for/i)
  ) {
    insertPrimary(
      firstMatching(records, comparisonFromProposalPayload) ??
        firstMatching(records, chartFromSmartPricingPreview),
      ['data_table', 'stat_list']
    );
  }
  if (
    !refusal &&
    messageHas(msg, /what happened|this booking.*history|booking history|status history/i)
  ) {
    insertPrimary(
      firstMatching(records, timelineFromBookingHistory) ??
        firstMatching(records, timelineFromActivityLog) ??
        firstMatching(records, calloutFromEmptyActivity)
    );
  }
  if (!refusal && messageHas(msg, /who changed|activity log|last week|yesterday/i)) {
    insertPrimary(
      firstMatching(records, timelineFromActivityLog) ??
        firstMatching(records, calloutFromEmptyActivity)
    );
  }
  if (!refusal && messageHas(msg, /last quarter|quarter vs|vs the one before/i)) {
    insertPrimary(
      comparisonFromFinancePeriods(records) ??
        firstMatching(records, comparisonFromFinanceTrendQuarters),
      ['stat_list', 'kpi', 'data_table', 'diagram']
    );
  }
  if (!refusal && messageHas(msg, /what did we fix|fixed last month|completed maintenance/i)) {
    insertPrimary(firstMatching(records, timelineFromMaintenance), ['data_table', 'stat_list']);
  }
  if (!refusal && messageHas(msg, /ai messages|messages do i have left|how many ai/i)) {
    insertPrimary(firstMatching(records, kpiFromPlanSnapshot), ['stat_list']);
  }
  if (
    !refusal &&
    messageHas(
      msg,
      /what did we post|posted last month|post last month|facebook story|last .*story|publish history|story go out/i
    )
  ) {
    insertPrimary(firstMatching(records, timelineFromPublishHistory));
  }
  if (!refusal && messageHas(msg, /pricing changes|list recent/i)) {
    insertPrimary(firstMatching(records, tableFromActivityLog), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /who are my guests|party size|lead time/i)) {
    insertPrimary(firstMatching(records, chartFromDemographics), ['data_table', 'stat_list']);
  }
  if (!refusal && messageHas(msg, /needs my attention|what needs attention|attention today/i)) {
    insertPrimary(firstMatching(records, checklistFromAttention), ['stat_list', 'data_table']);
  }
  if (!refusal && messageHas(msg, /setup guide/i)) {
    insertPrimary(firstMatching(records, checklistFromSetupGuide), ['stat_list', 'data_table']);
  }
  if (!refusal && messageHas(msg, /superhost/i)) {
    insertPrimary(firstMatching(records, checklistFromSuperhost), ['stat_list', 'data_table']);
  }
  if (
    !refusal &&
    messageHas(
      msg,
      /what maintenance is still open|maintenance overdue|any maintenance overdue|maintenance is overdue|overdue maintenance/i
    )
  ) {
    insertPrimary(firstMatching(records, checklistFromPendingTasks), ['data_table', 'stat_list']);
  }
  if (!refusal && messageHas(msg, /show my marketing templates|templates do i have/i)) {
    const cards = records.flatMap((record) => entityCardsFromListResult(record.__list ?? record));
    const templates = cards.filter((card) => card.entityType === 'marketing_template');
    insertPrimary(carouselFromEntityCards('Templates', templates.length ? templates : cards), [
      'image',
    ]);
  }
  if (!refusal && messageHas(msg, /brand themes|my themes|marketing themes/i)) {
    const cards = records.flatMap((record) => entityCardsFromListResult(record.__list ?? record));
    insertPrimary(
      carouselFromEntityCards('Themes', cards) ??
        cards[0] ?? {
          type: 'callout',
          tone: 'info',
          text: 'No brand themes yet.',
        },
      ['stat_list']
    );
  }
  if (
    !refusal &&
    messageHas(msg, /explain (revpar|adr|occupancy)|what is revpar|what does revpar/i)
  ) {
    insertPrimary(firstMatching(records, calloutFromMetricExplanation), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /list my marketing templates/i)) {
    insertPrimary(firstMatching(records, tableFromMarketingTemplates), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /compare my listings/i)) {
    insertPrimary(firstMatching(records, tableFromPortfolioListings), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /key numbers/i)) {
    insertPrimary(firstMatching(records, statListFromAnalytics));
  }
  if (!refusal && messageHas(msg, /who is on my team|team members/i)) {
    insertPrimary(firstMatching(records, tableFromTeamMembers), ['stat_list', 'data_table']);
  }
  if (!refusal && messageHas(msg, /any unread guest messages/i)) {
    insertPrimary(firstMatching(records, tableFromInboxThreads), ['stat_list']);
  }
  if (!refusal && messageHas(msg, /open the thread|thread with|show this thread/i)) {
    const cards = records.flatMap((record) => entityCardsFromListResult(record.__list ?? record));
    insertPrimary(cards.find((card) => card.entityType === 'inbox_thread') ?? cards[0], [
      'stat_list',
      'link_list',
    ]);
  }
  if (
    !refusal &&
    messageHas(
      msg,
      /waiting for a reply|need a reply|needs a reply|latest message|summarize .*message/i
    )
  ) {
    const cards = records.flatMap((record) => entityCardsFromListResult(record.__list ?? record));
    for (const card of cards.filter((item) => item.entityType === 'inbox_thread')) {
      if (
        !next.some((block) => block.type === 'entity_card' && 'id' in block && block.id === card.id)
      ) {
        insertPrimary(card);
      }
    }
  }

  const hasAnswerBlock = next.some((block) => {
    const type = block.type;
    return type && type !== 'text' && type !== 'activity_timeline' && type !== 'quick_actions';
  });
  for (let i = next.length - 1; i >= 0; i--) {
    const block = next[i] as { type?: string; text?: string };
    if (block.type === 'text' && /which listing or dates/i.test(asText(block.text))) {
      if (hasAnswerBlock || records.length > 0) next.splice(i, 1);
    }
  }

  return next as Array<T | VisualChatBlock>;
}

export function isHydratedBlock(block: unknown): boolean {
  return Boolean(block && typeof block === 'object' && (block as { hydrated?: boolean }).hydrated);
}
