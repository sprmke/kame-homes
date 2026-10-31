/**
 * Inline markdown for chat text (AI replies write it): **bold**, *italic* / _italic_, ~~strike~~,
 * `code`, [label](https://…). Parsed into segments, never HTML. Single `*` / `_` need a non-word
 * character on both sides so `booking_id` and `2*3*4` stay literal.
 */

export type InlineMark = 'bold' | 'italic' | 'strike' | 'code';

export type InlineSegment =
  | { type: 'text'; text: string; marks?: InlineMark[] }
  | { type: 'link'; href: string; text: string; marks?: InlineMark[] };

const TOKEN_SOURCE = [
  '`([^`\\n]+)`', // 1 code
  '\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)', // 2 label, 3 href
  '\\*\\*\\*(\\S(?:[^\\n]*?\\S)?)\\*\\*\\*', // 4 bold italic
  '\\*\\*(\\S(?:[^\\n]*?\\S)?)\\*\\*', // 5 bold
  '~~(\\S(?:[^\\n]*?\\S)?)~~', // 6 strike
  '(^|[^\\w*])\\*([^\\s*](?:[^\\n*]*?[^\\s*])?)\\*(?![\\w*])', // 7 prefix, 8 italic
  '(^|[^\\w])_([^\\s_](?:[^\\n_]*?[^\\s_])?)_(?!\\w)', // 9 prefix, 10 italic
].join('|');

function isSafeHttpsHref(href: string): boolean {
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

function withMark(marks: InlineMark[], mark: InlineMark): InlineMark[] {
  return marks.includes(mark) ? marks : [...marks, mark];
}

function textSegment(text: string, marks: InlineMark[]): InlineSegment {
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text };
}

function parseInline(text: string, marks: InlineMark[]): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(TOKEN_SOURCE, 'g'))) {
    const prefix = m[7] ?? m[9] ?? '';
    const start = (m.index ?? 0) + prefix.length;
    if (start > last) out.push(textSegment(text.slice(last, start), marks));

    if (m[1] !== undefined) {
      out.push(textSegment(m[1], withMark(marks, 'code')));
    } else if (m[2] !== undefined) {
      const href = m[3] ?? '';
      if (isSafeHttpsHref(href)) {
        const label = stripInlineMarkdown(m[2]);
        out.push(
          marks.length
            ? { type: 'link', href, text: label, marks }
            : { type: 'link', href, text: label }
        );
      } else {
        out.push(...parseInline(m[2], marks));
      }
    } else if (m[4] !== undefined) {
      out.push(...parseInline(m[4], withMark(withMark(marks, 'bold'), 'italic')));
    } else if (m[5] !== undefined) {
      out.push(...parseInline(m[5], withMark(marks, 'bold')));
    } else if (m[6] !== undefined) {
      out.push(...parseInline(m[6], withMark(marks, 'strike')));
    } else {
      out.push(...parseInline(m[8] ?? m[10] ?? '', withMark(marks, 'italic')));
    }
    last = (m.index ?? 0) + m[0].length;
  }
  if (last < text.length) out.push(textSegment(text.slice(last), marks));
  return out;
}

export function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) return [];
  return parseInline(text, []);
}

/** Same text without inline markers (copy, aria labels, status lookups). */
export function stripInlineMarkdown(text: string): string {
  return parseInline(text, [])
    .map((segment) => segment.text)
    .join('');
}

/** Plain-text copy of a markdown chat message: inline markers, heading `#` and quote `>` removed. */
export function markdownToPlainText(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      stripInlineMarkdown(line.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s{0,3}>\s?/, ''))
    )
    .join('\n');
}
