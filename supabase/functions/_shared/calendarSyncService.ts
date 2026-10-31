/**
 * Airbnb / OTA two-way calendar sync — pure engine helpers.
 * Plan: docs/workflow/done/airbnb-calendar-sync.md §6–§9
 *
 * This module is intentionally free of DB access so it can be unit-tested in isolation
 * (supabase/functions/_shared/calendarSyncService_test.ts). The `calendar-sync-cron`
 * edge function orchestrates the DB reads/writes around these functions.
 *
 * Overlap / date model: half-open `[start, end)` — checkout-exclusive — identical to
 * `property_blocked_dates` and Airbnb's own `DTEND`. No ±1 fudge anywhere.
 */

export type CalendarFeedProvider = 'airbnb' | 'booking_com' | 'vrbo' | 'other';

/** Reservation = a real stay; block = host-blocked / unavailable-gap night. */
export type CalendarEventKind = 'reservation' | 'block';

export interface ParsedCalendarEvent {
  /** VEVENT UID — the stable reservation identity across polls. */
  uid: string;
  /** Inclusive first night, `YYYY-MM-DD`. */
  startDate: string;
  /** Exclusive checkout day, `YYYY-MM-DD`. */
  endDate: string;
  /** Raw SUMMARY, verbatim. */
  summary: string;
  kind: CalendarEventKind;
  /** Airbnb confirmation code (`HM…`) parsed from the DESCRIPTION reservation URL, when present. */
  confirmationCode: string | null;
  /** Last 4 phone digits from DESCRIPTION, when present. NEVER written to a phone field. */
  phoneLast4: string | null;
  /** Raw unfolded VEVENT lines, for `external_raw` / debugging. */
  raw: Record<string, string>;
}

export interface ParsedCalendar {
  /** True only when the body was a well-formed VCALENDAR. */
  valid: boolean;
  /** valid && zero VEVENTs. */
  empty: boolean;
  events: ParsedCalendarEvent[];
  /** Per-VEVENT parse problems — never abort the run, just log these. */
  warnings: string[];
}

// ─── RFC 5545 line handling ───────────────────────────────────────────────────

/** Unfold folded content lines (a line beginning with SPACE or TAB continues the previous). */
export function unfoldIcsLines(body: string): string[] {
  const rawLines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Split `NAME;PARAM=x:VALUE` into `{ name, params, value }` (name upper-cased). */
function splitContentLine(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = left.indexOf(';');
  if (semi < 0) return { name: left.toUpperCase(), params: '', value };
  return { name: left.slice(0, semi).toUpperCase(), params: left.slice(semi + 1), value };
}

// ─── Date parsing ────────────────────────────────────────────────────────────

const DATE_ONLY_RE = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/;

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function ymdKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Manila is UTC+8 year-round (no DST). Floor a UTC instant to its Manila calendar date. */
function manilaDateKeyFromUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number
): string {
  const t = Date.UTC(y, m - 1, d, hh, mm, ss) + 8 * 3600 * 1000;
  const dt = new Date(t);
  return ymdKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/**
 * Parse a DTSTART/DTEND value to a `YYYY-MM-DD` night key.
 * Accepts `VALUE=DATE` (`YYYYMMDD`) and datetime (`YYYYMMDDTHHMMSSZ` or local — floored to Manila).
 */
export function parseIcsDateToKey(value: string, params: string): string | null {
  const v = value.trim();
  const dateOnly = DATE_ONLY_RE.exec(v);
  if (dateOnly) {
    const [, ys, ms, ds] = dateOnly;
    const y = Number(ys),
      m = Number(ms),
      d = Number(ds);
    return isValidYmd(y, m, d) ? ymdKey(y, m, d) : null;
  }
  const dt = DATE_TIME_RE.exec(v);
  if (dt) {
    const [, ys, ms, ds, hs, mis, sss, z] = dt;
    const y = Number(ys),
      m = Number(ms),
      d = Number(ds);
    if (!isValidYmd(y, m, d)) return null;
    // `Z` (or a params-declared TZID we don't resolve) → treat as UTC and floor to Manila.
    // A bare local datetime with no zone: treat the wall-clock date as-is.
    if (z || /TZID=/i.test(params)) {
      return manilaDateKeyFromUtc(y, m, d, Number(hs), Number(mis), Number(sss));
    }
    return ymdKey(y, m, d);
  }
  return null;
}

// ─── Provider SUMMARY classification ─────────────────────────────────────────

/**
 * Decide whether a VEVENT is a real reservation or a host block.
 * `createBookings` only matters for Booking.com, whose feed does not distinguish the two
 * (plan §17 Q7 — accepted limitation).
 */
export function classifyEventKind(
  provider: CalendarFeedProvider,
  summary: string,
  createBookings: boolean
): CalendarEventKind {
  const s = summary.trim().toLowerCase();
  switch (provider) {
    case 'airbnb':
      // "Reserved" = booking. "Airbnb (Not available)" / "Blocked" / "Not available" = block.
      return s === 'reserved' ? 'reservation' : 'block';
    case 'vrbo':
      return s.startsWith('reserved') ? 'reservation' : 'block';
    case 'booking_com':
      // "CLOSED - Not available" for everything. When ingesting bookings, treat all as reservations.
      return createBookings ? 'reservation' : 'block';
    case 'other':
    default:
      // Generic iCal: anything that isn't obviously a "blocked/unavailable/closed" label is a stay.
      if (/(not available|unavailable|blocked|closed|owner block)/.test(s)) return 'block';
      return createBookings ? 'reservation' : 'block';
  }
}

const AIRBNB_CONFIRMATION_RE = /reservations\/details\/([A-Z0-9]{6,})/i;
const PHONE_LAST4_RE = /Last\s*4\s*Digits\)?:?\s*(\d{4})/i;

export function airbnbConfirmationCodeFromDescription(description: string): string | null {
  const m = AIRBNB_CONFIRMATION_RE.exec(description);
  return m ? m[1].toUpperCase() : null;
}

export function phoneLast4FromDescription(description: string): string | null {
  const m = PHONE_LAST4_RE.exec(description);
  return m ? m[1] : null;
}

// ─── VCALENDAR parsing ──────────────────────────────────────────────────────

/**
 * Parse an iCalendar body. Never throws — a malformed body returns `{ valid:false }`,
 * a malformed single VEVENT is skipped with a `warnings` entry.
 */
export function parseIcsCalendar(
  body: string,
  provider: CalendarFeedProvider,
  createBookings: boolean
): ParsedCalendar {
  const warnings: string[] = [];
  if (!body || !/BEGIN:VCALENDAR/i.test(body) || !/END:VCALENDAR/i.test(body)) {
    return { valid: false, empty: false, events: [], warnings: ['no VCALENDAR envelope'] };
  }

  const lines = unfoldIcsLines(body);
  const events: ParsedCalendarEvent[] = [];
  const seenUids = new Set<string>();

  let inEvent = false;
  let cur: Record<string, { value: string; params: string }> = {};

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(trimmed)) {
      inEvent = true;
      cur = {};
      continue;
    }
    if (/^END:VEVENT$/i.test(trimmed)) {
      inEvent = false;
      const parsed = finalizeEvent(cur, provider, createBookings, warnings);
      if (parsed) {
        if (seenUids.has(parsed.uid)) {
          // Last wins; note the earlier one.
          const idx = events.findIndex((e) => e.uid === parsed.uid);
          if (idx >= 0) events.splice(idx, 1);
          warnings.push(`duplicate UID ${parsed.uid} — last occurrence kept`);
        }
        seenUids.add(parsed.uid);
        events.push(parsed);
      }
      continue;
    }
    if (!inEvent) continue;
    const sc = splitContentLine(trimmed);
    if (!sc) continue;
    // Keep the first occurrence of each property within a VEVENT.
    if (!(sc.name in cur)) cur[sc.name] = { value: sc.value, params: sc.params };
  }

  return { valid: true, empty: events.length === 0, events, warnings };
}

function unescapeIcsText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function finalizeEvent(
  cur: Record<string, { value: string; params: string }>,
  provider: CalendarFeedProvider,
  createBookings: boolean,
  warnings: string[]
): ParsedCalendarEvent | null {
  const uid = cur.UID?.value?.trim();
  if (!uid) {
    warnings.push('VEVENT missing UID — skipped');
    return null;
  }
  const dtStart = cur.DTSTART;
  const dtEnd = cur.DTEND;
  if (!dtStart || !dtEnd) {
    warnings.push(`VEVENT ${uid} missing DTSTART/DTEND — skipped`);
    return null;
  }
  const startDate = parseIcsDateToKey(dtStart.value, dtStart.params);
  const endDate = parseIcsDateToKey(dtEnd.value, dtEnd.params);
  if (!startDate || !endDate) {
    warnings.push(`VEVENT ${uid} unparseable dates — skipped`);
    return null;
  }
  if (endDate <= startDate) {
    warnings.push(`VEVENT ${uid} DTEND <= DTSTART — skipped`);
    return null;
  }

  const summary = unescapeIcsText(cur.SUMMARY?.value ?? '').trim();
  const description = unescapeIcsText(cur.DESCRIPTION?.value ?? '');
  const kind = classifyEventKind(provider, summary, createBookings);

  return {
    uid,
    startDate,
    endDate,
    summary,
    kind,
    confirmationCode:
      kind === 'reservation' ? airbnbConfirmationCodeFromDescription(description) : null,
    phoneLast4: kind === 'reservation' ? phoneLast4FromDescription(description) : null,
    raw: {
      uid,
      dtstart: dtStart.value,
      dtend: dtEnd.value,
      summary,
      description,
    },
  };
}

// ─── Diff ───────────────────────────────────────────────────────────────────

export interface CurrentBlockRow {
  id: string;
  externalUid: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  externalSummary: string | null;
}

export interface FeedDiff {
  creates: ParsedCalendarEvent[];
  /** Same UID, dates changed. */
  reschedules: Array<{ row: CurrentBlockRow; event: ParsedCalendarEvent }>;
  /** Same UID + dates; summary may have changed. */
  touches: Array<{ row: CurrentBlockRow; event: ParsedCalendarEvent; summaryChanged: boolean }>;
  /** In DB, gone from the feed → cancellation / silent-drop. */
  removes: CurrentBlockRow[];
}

/**
 * Reconcile parsed feed events against the feed's current `ical_import` blocked rows.
 * Pure — callers decide whether `removes` are safe to apply (truncation guards live in the cron).
 */
export function diffFeed(events: ParsedCalendarEvent[], current: CurrentBlockRow[]): FeedDiff {
  const byUidEvent = new Map<string, ParsedCalendarEvent>();
  for (const e of events) byUidEvent.set(e.uid, e);
  const byUidRow = new Map<string, CurrentBlockRow>();
  for (const r of current) byUidRow.set(r.externalUid, r);

  const diff: FeedDiff = { creates: [], reschedules: [], touches: [], removes: [] };

  for (const e of events) {
    const row = byUidRow.get(e.uid);
    if (!row) {
      diff.creates.push(e);
      continue;
    }
    if (row.startDate !== e.startDate || row.endDate !== e.endDate) {
      diff.reschedules.push({ row, event: e });
    } else {
      diff.touches.push({
        row,
        event: e,
        summaryChanged: (row.externalSummary ?? '') !== e.summary,
      });
    }
  }
  for (const r of current) {
    if (!byUidEvent.has(r.externalUid)) diff.removes.push(r);
  }
  return diff;
}

// ─── Overlap ────────────────────────────────────────────────────────────────

/** Half-open `[aStart, aEnd)` intersects `[bStart, bEnd)` — string `YYYY-MM-DD` compares lexically. */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ─── Export (GFM → OTA) ─────────────────────────────────────────────────────

export interface ExportBusyRange {
  /** `gfm-booking-<id>` / `gfm-block-<id>` — stable so a date edit reads as an update on the OTA. */
  uidLocalPart: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD, exclusive
  summary: 'Booked' | 'Blocked';
}

/** Fold a content line at 75 octets per RFC 5545 §3.1 (CRLF + leading space). */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(' ' + rest);
  return parts.join('\r\n');
}

function ymdToIcsDate(key: string): string {
  return key.replace(/-/g, '');
}

export interface BuildExportOptions {
  calendarName: string;
  /** e.g. the Supabase project ref — makes our UIDs globally unique. */
  uidDomain: string;
  ranges: ExportBusyRange[];
  /** Newest contributing `updated_at` ISO string — drives Last-Modified / ETag. */
  lastModifiedIso?: string | null;
}

export function buildExportCalendar(opts: BuildExportOptions): string {
  const stamp = (opts.lastModifiedIso ? new Date(opts.lastModifiedIso) : new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const sorted = [...opts.ranges].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.uidLocalPart.localeCompare(b.uidLocalPart)
  );

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GFM//Calendar Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${opts.calendarName}`),
  ];
  for (const r of sorted) {
    lines.push(
      'BEGIN:VEVENT',
      foldIcsLine(`UID:${r.uidLocalPart}@${opts.uidDomain}`),
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdToIcsDate(r.startDate)}`,
      `DTEND;VALUE=DATE:${ymdToIcsDate(r.endDate)}`,
      `SUMMARY:${r.summary}`,
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ─── SSRF-guarded fetch ─────────────────────────────────────────────────────

export class ExternalFetchError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'ExternalFetchError';
  }
}

/** Provider → allowed host suffixes. `other` allows any public host (still IP-guarded). */
const PROVIDER_HOST_ALLOWLIST: Record<Exclude<CalendarFeedProvider, 'other'>, string[]> = {
  airbnb: ['airbnb.com', 'airbnb.co.uk', 'airbnb.ca', 'airbnb.com.au', 'muscache.com'],
  booking_com: ['booking.com', 'admin.booking.com', 'ical.booking.com'],
  vrbo: ['vrbo.com', 'homeaway.com', 'abritel.fr', 'expediagroup.com'],
};

function hostMatchesSuffix(host: string, suffixes: string[]): boolean {
  const h = host.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith('.' + s));
}

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
];

function isPrivateIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return PRIVATE_IPV4.some((re) => re.test(h));
  }
  // IPv6: loopback, link-local (fe80::/10), ULA (fc00::/7), and v4-mapped private ranges.
  if (h.includes(':')) {
    const lower = h.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (/^fe[89ab]/.test(lower) || /^f[cd]/.test(lower)) return true;
    const mapped = /::ffff:(\d{1,3}(\.\d{1,3}){3})$/.exec(lower);
    if (mapped) return PRIVATE_IPV4.some((re) => re.test(mapped[1]));
  }
  return false;
}

async function assertHostNotPrivate(host: string): Promise<void> {
  if (isPrivateIpLiteral(host)) {
    throw new ExternalFetchError(`refusing private/loopback host ${host}`, 'private_host');
  }
  const bare = host.toLowerCase();
  if (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('.internal') ||
    bare.endsWith('.local')
  ) {
    throw new ExternalFetchError(`refusing internal host ${host}`, 'private_host');
  }
  // Best-effort DNS check — resolveDns may be unavailable in some runtimes.
  try {
    const [a, aaaa] = await Promise.allSettled([
      Deno.resolveDns(host, 'A'),
      Deno.resolveDns(host, 'AAAA'),
    ]);
    const addrs = [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
    ];
    for (const addr of addrs) {
      if (isPrivateIpLiteral(addr)) {
        throw new ExternalFetchError(
          `host ${host} resolves to private address ${addr}`,
          'private_host'
        );
      }
    }
  } catch (err) {
    if (err instanceof ExternalFetchError) throw err;
    // resolveDns not permitted / failed — literal + allowlist checks still stand.
  }
}

/**
 * Non-network shape validation for a user-supplied feed URL — run at config time before we
 * ever store or fetch it. `fetchExternalIcs` repeats these checks (plus DNS) at fetch time.
 * Returns the normalized URL (e.g. webcal:// → https://) for storage.
 */
export function normalizeExternalIcsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^webcal:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice('webcal://'.length)}`;
  }
  return trimmed;
}

export function assertExternalIcsUrlShape(rawUrl: string, provider: CalendarFeedProvider): string {
  const normalized = normalizeExternalIcsUrl(rawUrl);
  if (!normalized) {
    throw new ExternalFetchError('Enter a valid URL', 'bad_url');
  }
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    throw new ExternalFetchError('Enter a valid URL', 'bad_url');
  }
  if (u.protocol !== 'https:') {
    throw new ExternalFetchError('The calendar URL must start with https://', 'not_https');
  }
  if (u.username || u.password) {
    throw new ExternalFetchError(
      'The calendar URL must not contain credentials',
      'has_credentials'
    );
  }
  if (isPrivateIpLiteral(u.hostname) || u.hostname.toLowerCase() === 'localhost') {
    throw new ExternalFetchError('That host is not allowed', 'private_host');
  }
  if (provider !== 'other') {
    const allow = PROVIDER_HOST_ALLOWLIST[provider];
    if (!hostMatchesSuffix(u.hostname, allow)) {
      throw new ExternalFetchError(
        `For ${provider}, the URL must be on ${allow[0]}`,
        'host_not_allowed'
      );
    }
  }
  return normalized;
}

export interface FetchIcsOptions {
  provider: CalendarFeedProvider;
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface FetchIcsResult {
  status: number;
  notModified: boolean;
  body: string;
  etag: string | null;
  lastModified: string | null;
}

/**
 * Fetch an external iCal URL with SSRF protection: https only, no credentials, private-IP
 * rejection (literal + resolved), manual redirect loop with per-hop re-validation, timeout,
 * response-size cap. Known providers are additionally host-allowlisted.
 */
export async function fetchExternalIcs(
  rawUrl: string,
  opts: FetchIcsOptions
): Promise<FetchIcsResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;

  let current: URL;
  try {
    current = new URL(normalizeExternalIcsUrl(rawUrl));
  } catch {
    throw new ExternalFetchError('malformed URL', 'bad_url');
  }

  for (let hop = 0; hop < 4; hop++) {
    if (current.protocol !== 'https:') {
      throw new ExternalFetchError(`refusing non-https URL (${current.protocol})`, 'not_https');
    }
    if (current.username || current.password) {
      throw new ExternalFetchError('refusing URL with embedded credentials', 'has_credentials');
    }
    if (opts.provider !== 'other') {
      const allow = PROVIDER_HOST_ALLOWLIST[opts.provider];
      if (!hostMatchesSuffix(current.hostname, allow)) {
        throw new ExternalFetchError(
          `host ${current.hostname} is not allowed for provider ${opts.provider}`,
          'host_not_allowed'
        );
      }
    }
    await assertHostNotPrivate(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp: Response;
    try {
      const headers: Record<string, string> = {
        Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1',
        'User-Agent': 'GFM-CalendarSync/1.0',
      };
      if (hop === 0 && opts.etag) headers['If-None-Match'] = opts.etag;
      if (hop === 0 && opts.lastModified) headers['If-Modified-Since'] = opts.lastModified;
      resp = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new ExternalFetchError(
        `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        'fetch_failed'
      );
    }
    clearTimeout(timer);

    if (resp.status === 304) {
      return {
        status: 304,
        notModified: true,
        body: '',
        etag: opts.etag ?? null,
        lastModified: opts.lastModified ?? null,
      };
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc)
        throw new ExternalFetchError(`redirect ${resp.status} without Location`, 'bad_redirect');
      try {
        current = new URL(loc, current);
      } catch {
        throw new ExternalFetchError('redirect to malformed URL', 'bad_redirect');
      }
      continue;
    }

    if (resp.status < 200 || resp.status >= 300) {
      throw new ExternalFetchError(`upstream returned ${resp.status}`, `http_${resp.status}`);
    }

    // Size-capped read.
    const reader = resp.body?.getReader();
    if (!reader) {
      const text = await resp.text();
      if (text.length > maxBytes) throw new ExternalFetchError('response too large', 'too_large');
      return {
        status: resp.status,
        notModified: false,
        body: text,
        etag: resp.headers.get('etag'),
        lastModified: resp.headers.get('last-modified'),
      };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new ExternalFetchError('response too large', 'too_large');
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.byteLength;
    }
    return {
      status: resp.status,
      notModified: false,
      body: new TextDecoder().decode(merged),
      etag: resp.headers.get('etag'),
      lastModified: resp.headers.get('last-modified'),
    };
  }

  throw new ExternalFetchError('too many redirects', 'too_many_redirects');
}

// ─── Misc helpers ───────────────────────────────────────────────────────────

/** `YYYY-MM-DD` → `MM-DD-YYYY` (the dominant stored format on guest_submissions). */
export function ymdToMmDdYyyy(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? `${m[2]}-${m[3]}-${m[1]}` : key;
}

/** Whole nights between two `YYYY-MM-DD` keys (checkout-exclusive). */
export function nightsBetween(startKey: string, endKey: string): number {
  const s = Date.parse(startKey + 'T00:00:00Z');
  const e = Date.parse(endKey + 'T00:00:00Z');
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 86_400_000);
}

/** SHA-256 hex of a normalized feed body — used to skip a diff when the feed is byte-identical. */
export async function hashFeedBody(body: string): Promise<string> {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
