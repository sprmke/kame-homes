/**
 * Client-side rich blocks from plain chat `body_text` (Phase 6.1b).
 * No HTML — detectors only. Maps → map card; lists → ul/ol; https → linkify.
 */

export type ChatRichSegment =
  { type: 'text'; text: string } | { type: 'link'; href: string; text: string };

export type ChatUrlLinkResourceKind =
  | 'calendar'
  | 'stayGuide'
  | 'document'
  | 'form'
  | 'messages'
  | 'showcase'
  | 'property'
  | 'parking'
  | 'review'
  | 'sdForm'
  | 'generic';

export type ChatRichBlock =
  | { type: 'paragraph'; segments: ChatRichSegment[] }
  | { type: 'list'; ordered: boolean; items: ChatRichSegment[][] }
  | { type: 'flow'; title?: string; steps: string[] }
  | { type: 'diagram'; title?: string; format: 'mermaid' | 'text'; source: string }
  | {
      type: 'form';
      title?: string;
      fields: Array<{ label: string; hint?: string; required: boolean }>;
    }
  | { type: 'dataTable'; title?: string; columns: string[]; rows: string[][] }
  | {
      type: 'mapLink';
      href: string;
      lat: number | null;
      lng: number | null;
      label: string;
    }
  | {
      type: 'urlLink';
      href: string;
      title: string;
      subtitle: string;
      variant: 'calendar' | 'generic';
      resourceKind: ChatUrlLinkResourceKind;
    };

/** Strip invisible / soft-break chars that break URL detection in transcripts. */
export function normalizeChatText(raw: string): string {
  return raw.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '').replace(/\u00A0/g, ' ');
}

/**
 * Prefer Latin-script captions for this product (EN/Filipino). Drops sudden Indic/CJK
 * STT garble from Gemini Live when the guest was speaking English (known native-audio quirk).
 */
export function isMostlyLatinScript(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters.length) return true;
  const latin = (letters.match(/\p{Script=Latin}/gu) ?? []).length;
  return latin / letters.length >= 0.65;
}

/** https URLs; trims common trailing punctuation from the match. */
const URL_RE = /https:\/\/[^\s<>"'`]+/gi;
const FENCED_BLOCK_RE = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;

const LIST_UNORDERED_RE = /^\s*([-•*])\s+(.*)$/;
const LIST_ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;

function isSafeHttpsUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function trimTrailingUrlPunctuation(raw: string): string {
  return raw.replace(/[),.;:!?\]]+$/g, '');
}

export function isGoogleMapsUrl(href: string): boolean {
  try {
    const u = new URL(normalizeChatText(href).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'maps.app.goo.gl') return true;
    if (host === 'goo.gl' && u.pathname.startsWith('/maps')) return true;
    if (host === 'maps.google.com' || host.endsWith('.maps.google.com')) return true;
    if (host === 'google.com' || host.endsWith('.google.com')) {
      return (
        u.pathname.startsWith('/maps') ||
        u.searchParams.has('q') ||
        u.searchParams.has('query') ||
        u.searchParams.has('ll')
      );
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Best-effort lat/lng from common Google Maps URL shapes.
 * Returns nulls when the link is a short redirect or place-only query.
 */
export function parseMapsCoordinates(href: string): { lat: number; lng: number } | null {
  try {
    const u = new URL(href);
    const at = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    for (const key of ['q', 'query', 'll'] as const) {
      const raw = u.searchParams.get(key);
      if (!raw) continue;
      const decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
      const pair = decoded.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
      if (pair) {
        const lat = Number(pair[1]);
        const lng = Number(pair[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }

    const dest = u.searchParams.get('destination');
    if (dest) {
      const pair = decodeURIComponent(dest).match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
      if (pair) {
        const lat = Number(pair[1]);
        const lng = Number(pair[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function mapLabelFromHref(href: string, coords: { lat: number; lng: number } | null): string {
  try {
    const u = new URL(href);
    const q = u.searchParams.get('query') ?? u.searchParams.get('q');
    if (q) {
      const decoded = decodeURIComponent(q.replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(decoded)) {
        return decoded.length > 48 ? `${decoded.slice(0, 45)}…` : decoded;
      }
    }
  } catch {
    // ignore
  }
  if (coords) {
    return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  }
  return 'Location';
}

function displayLinkText(href: string): string {
  try {
    const u = new URL(href);
    const path = `${u.pathname}${u.search}`.replace(/\/$/, '');
    const short = path.length > 28 ? `${path.slice(0, 25)}…` : path || '';
    return short ? `${u.hostname}${short}` : u.hostname;
  } catch {
    return href;
  }
}

/** Title + chip variant for non-map https links (calendar / property / generic). */
export function urlLinkCardMeta(href: string): {
  title: string;
  subtitle: string;
  variant: 'calendar' | 'generic';
  resourceKind: ChatUrlLinkResourceKind;
} {
  try {
    const u = new URL(href);
    const path = u.pathname.toLowerCase();
    const host = u.hostname.replace(/^www\./, '');
    if (path.includes('/calendar')) {
      return {
        title: 'Check availability',
        subtitle: host,
        variant: 'calendar',
        resourceKind: 'calendar',
      };
    }
    if (path.includes('/stay-guide')) {
      return {
        title: 'Stay Guide',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'stayGuide',
      };
    }
    if (path.includes('/showcase')) {
      return {
        title: 'Property showcase',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'showcase',
      };
    }
    if (path.includes('/document')) {
      const doc = u.searchParams.get('doc');
      const title =
        doc === 'pet' ? 'Approved Pet Form' : doc === 'gaf' ? 'Approved GAF' : 'Document';
      return { title, subtitle: host, variant: 'generic', resourceKind: 'document' };
    }
    if (path.includes('/messages')) {
      return {
        title: 'Chat with host',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'messages',
      };
    }
    if (path.includes('/form')) {
      return { title: 'Guest form', subtitle: host, variant: 'generic', resourceKind: 'form' };
    }
    if (path.includes('/sd-form')) {
      return {
        title: 'Security Deposit Refund',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'sdForm',
      };
    }
    if (path.includes('/guest-review')) {
      return {
        title: 'Leave a Review',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'review',
      };
    }
    if (path.includes('/parking/')) {
      return { title: 'Pay Parking', subtitle: host, variant: 'generic', resourceKind: 'parking' };
    }
    if (path.includes('/storage/v1/object/public/parking-endorsements/')) {
      return {
        title: 'Parking Endorsement',
        subtitle: host,
        variant: 'generic',
        resourceKind: 'parking',
      };
    }
    if (/\/properties\/[^/]+\/?$/.test(path) || path.includes('/properties/')) {
      const slug = path.split('/properties/')[1]?.split('/')[0];
      const label = slug
        ? slug
            .split('-')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : 'Property';
      return {
        title: label,
        subtitle: 'View property',
        variant: 'generic',
        resourceKind: 'property',
      };
    }
    return { title: host, subtitle: 'Open link', variant: 'generic', resourceKind: 'generic' };
  } catch {
    return {
      title: 'Open link',
      subtitle: displayLinkText(href),
      variant: 'generic',
      resourceKind: 'generic',
    };
  }
}

/** Turn a prose chunk into paragraph + map blocks in document order. */
function blocksFromProse(text: string): ChatRichBlock[] {
  const out: ChatRichBlock[] = [];
  let segments: ChatRichSegment[] = [];

  const flushSegments = () => {
    let cleaned = segments.filter((s) => !(s.type === 'text' && s.text.length === 0));
    segments = [];
    if (!cleaned.length || isBlankSegments(cleaned)) return;

    // Drop leading/trailing whitespace-only noise around map cards.
    const first = cleaned[0];
    if (first?.type === 'text') {
      const t = first.text.replace(/^\s+/, '');
      if (!t) cleaned = cleaned.slice(1);
      else cleaned = [{ type: 'text', text: t }, ...cleaned.slice(1)];
    }
    const last = cleaned[cleaned.length - 1];
    if (last?.type === 'text') {
      const t = last.text.replace(/\s+$/, '');
      if (!t) cleaned = cleaned.slice(0, -1);
      else cleaned = [...cleaned.slice(0, -1), { type: 'text', text: t }];
    }
    if (!cleaned.length || isBlankSegments(cleaned)) return;
    out.push({ type: 'paragraph', segments: cleaned });
  };

  URL_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  const src = text;

  while ((match = URL_RE.exec(src)) !== null) {
    const raw = match[0];
    const href = trimTrailingUrlPunctuation(raw);
    if (!isSafeHttpsUrl(href)) continue;

    const start = match.index;
    if (start > last) {
      segments.push({ type: 'text', text: src.slice(last, start) });
    }

    if (isGoogleMapsUrl(href)) {
      flushSegments();
      const coords = parseMapsCoordinates(href);
      out.push({
        type: 'mapLink',
        href,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        label: mapLabelFromHref(href, coords),
      });
    } else {
      // Prefer a tap card over wrapping raw URLs mid-bubble (voice + inbox).
      flushSegments();
      const meta = urlLinkCardMeta(href);
      out.push({
        type: 'urlLink',
        href,
        title: meta.title,
        subtitle: meta.subtitle,
        variant: meta.variant,
        resourceKind: meta.resourceKind,
      });
    }

    last = start + raw.length;
    if (href.length < raw.length) {
      segments.push({ type: 'text', text: raw.slice(href.length) });
    }
  }

  if (last < src.length) {
    segments.push({ type: 'text', text: src.slice(last) });
  }
  flushSegments();
  return out;
}

function isBlankSegments(segments: ChatRichSegment[]): boolean {
  return segments.every((s) => s.type === 'text' && !s.text.trim());
}

type LineKind =
  | { kind: 'unordered'; body: string }
  | { kind: 'ordered'; body: string; n: number }
  | { kind: 'text'; body: string };

function classifyLine(line: string): LineKind {
  const u = line.match(LIST_UNORDERED_RE);
  if (u) return { kind: 'unordered', body: u[2] ?? '' };
  const o = line.match(LIST_ORDERED_RE);
  if (o) return { kind: 'ordered', body: o[2] ?? '', n: Number(o[1]) };
  return { kind: 'text', body: line };
}

function flushParagraph(buffer: string[], out: ChatRichBlock[]) {
  if (!buffer.length) return;
  const text = buffer.join('\n').trimEnd();
  buffer.length = 0;
  if (!text.trim()) return;
  out.push(...blocksFromProse(text));
}

function flushList(ordered: boolean, items: string[], out: ChatRichBlock[]) {
  if (!items.length) return;
  const parsedItems: ChatRichSegment[][] = [];
  const afterMaps: ChatRichBlock[] = [];

  for (const item of items) {
    const itemBlocks = blocksFromProse(item);
    const segs: ChatRichSegment[] = [];
    for (const b of itemBlocks) {
      if (b.type === 'paragraph') segs.push(...b.segments);
      else if (b.type === 'mapLink') afterMaps.push(b);
    }
    parsedItems.push(segs.length ? segs : [{ type: 'text', text: item }]);
  }

  out.push({ type: 'list', ordered, items: parsedItems });
  out.push(...afterMaps);
}

function parsePlainTextBlocks(raw: string): ChatRichBlock[] {
  const text = normalizeChatText(raw).replace(/\r\n/g, '\n');
  if (!text.trim()) {
    return [];
  }

  const lines = text.split('\n');
  const out: ChatRichBlock[] = [];
  const paragraphBuf: string[] = [];
  let listMode: 'unordered' | 'ordered' | null = null;
  let listItems: string[] = [];

  const endList = () => {
    if (listMode && listItems.length) {
      flushList(listMode === 'ordered', listItems, out);
    }
    listMode = null;
    listItems = [];
  };

  for (const line of lines) {
    const kind = classifyLine(line);

    if (kind.kind === 'unordered' || kind.kind === 'ordered') {
      flushParagraph(paragraphBuf, out);
      const mode = kind.kind;
      if (listMode && listMode !== mode) {
        endList();
      }
      listMode = mode;
      listItems.push(kind.body);
      continue;
    }

    // Blank line ends a list; otherwise blank lines stay in paragraph flow.
    if (listMode && line.trim() === '') {
      endList();
      continue;
    }

    if (listMode) {
      endList();
    }
    paragraphBuf.push(line);
  }

  endList();
  flushParagraph(paragraphBuf, out);

  return out.length ? out : [{ type: 'paragraph', segments: [{ type: 'text', text }] }];
}

function extractOptionalTitle(lines: string[]): { title?: string; bodyLines: string[] } {
  const [first, ...rest] = lines;
  if (!first) return { bodyLines: [] };
  const match = first.match(/^title\s*:\s*(.+)$/i);
  if (!match) return { bodyLines: lines };
  return { title: match[1]?.trim() || undefined, bodyLines: rest };
}

function parseFlowBlock(body: string): Extract<ChatRichBlock, { type: 'flow' }> | null {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const { title, bodyLines } = extractOptionalTitle(lines);
  const steps = bodyLines
    .map((line) =>
      line
        .replace(/^\d+[.)]\s+/, '')
        .replace(/^[-*]\s+/, '')
        .trim()
    )
    .filter(Boolean);
  if (steps.length === 0) return null;
  return { type: 'flow', title, steps };
}

function parseDiagramBlock(
  body: string,
  format: 'mermaid' | 'text'
): Extract<ChatRichBlock, { type: 'diagram' }> | null {
  const lines = body.split('\n');
  const { title, bodyLines } = extractOptionalTitle(lines);
  const source = bodyLines.join('\n').trim();
  if (!source) return null;
  return { type: 'diagram', title, format, source };
}

function parseFormBlock(body: string): Extract<ChatRichBlock, { type: 'form' }> | null {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const { title, bodyLines } = extractOptionalTitle(lines);
  const fields = bodyLines.reduce<Array<{ label: string; hint?: string; required: boolean }>>(
    (acc, line) => {
      const cleaned = line.replace(/^[-*]\s+/, '').trim();
      const [labelPart, ...hintParts] = cleaned.split(':');
      const labelRaw = (labelPart ?? '').trim();
      const required =
        /\(\s*required\s*\)\s*$/i.test(cleaned) || /\*$/.test(cleaned) || /\*$/.test(labelRaw);
      const withoutRequired = cleaned
        .replace(/\(\s*required\s*\)\s*$/i, '')
        .replace(/\*$/, '')
        .trim();
      const [withoutRequiredLabel, ...withoutRequiredHintParts] = withoutRequired.split(':');
      const label = (withoutRequiredLabel ?? '').trim().replace(/\*$/, '').trim();
      const hint = hintParts.join(':').trim() || undefined;
      const fallbackHint = withoutRequiredHintParts.join(':').trim() || undefined;
      if (!label) return acc;
      const resolvedHint = hint ?? fallbackHint;
      acc.push(resolvedHint ? { label, hint: resolvedHint, required } : { label, required });
      return acc;
    },
    []
  );
  if (fields.length === 0) return null;
  return { type: 'form', title, fields };
}

function parseTableBlock(body: string): Extract<ChatRichBlock, { type: 'dataTable' }> | null {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const { title, bodyLines } = extractOptionalTitle(lines);
  const rows = bodyLines
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, ''))
    .map((line) => line.split('|').map((cell) => cell.trim()));
  if (rows.length < 2) return null;
  const isDivider = (cell: string) => /^:?-{3,}:?$/.test(cell);
  const maybeDivider = rows[1] ?? [];
  const hasDivider = maybeDivider.length > 0 && maybeDivider.every(isDivider);
  const columns = rows[0]?.filter(Boolean) ?? [];
  const dataRows = (hasDivider ? rows.slice(2) : rows.slice(1))
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
  if (columns.length === 0 || dataRows.length === 0) return null;
  return { type: 'dataTable', title, columns, rows: dataRows };
}

function parseStructuredFence(langRaw: string | undefined, body: string): ChatRichBlock | null {
  const lang = (langRaw ?? '').trim().toLowerCase();
  if (!lang) return null;
  if (lang === 'flow' || lang === 'workflow' || lang === 'steps') {
    return parseFlowBlock(body);
  }
  if (lang === 'mermaid') return parseDiagramBlock(body, 'mermaid');
  if (lang === 'diagram') return parseDiagramBlock(body, 'text');
  if (lang === 'form' || lang === 'fields') return parseFormBlock(body);
  if (lang === 'table' || lang === 'markdown-table' || lang === 'csv') return parseTableBlock(body);
  return null;
}

/**
 * Parse plain message text into rich blocks for `ChatRichBody`.
 */
export function parseChatRichBlocks(raw: string): ChatRichBlock[] {
  const text = normalizeChatText(raw).replace(/\r\n/g, '\n');
  if (!text.trim()) {
    return [{ type: 'paragraph', segments: [{ type: 'text', text: '-' }] }];
  }

  const out: ChatRichBlock[] = [];
  let cursor = 0;
  FENCED_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FENCED_BLOCK_RE.exec(text)) !== null) {
    const start = match.index;
    if (start > cursor) {
      out.push(...parsePlainTextBlocks(text.slice(cursor, start)));
    }
    const structured = parseStructuredFence(match[1], match[2] ?? '');
    if (structured) {
      out.push(structured);
    } else {
      out.push(...parsePlainTextBlocks(match[0]));
    }
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    out.push(...parsePlainTextBlocks(text.slice(cursor)));
  }

  return out.length ? out : [{ type: 'paragraph', segments: [{ type: 'text', text }] }];
}

/** @deprecated Prefer Google/OSM embed via `resolvePropertyMapEmbedSrc` — kept for callers/tests. */
export function osmStaticMapUrl(lat: number, lng: number, width = 600, height = 280): string {
  const w = Math.min(Math.max(width, 200), 800);
  const h = Math.min(Math.max(height, 120), 400);
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=${w}x${h}&markers=${lat},${lng},lightblue1`;
}
