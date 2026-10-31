import {
  isBlockLevelPropertyPlaceholder,
  placeholderTokenForKey,
} from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

function normalizePlaceholderKey(raw: string): string {
  return raw.trim().replace(/-/g, '_');
}

function isExclusiveBlockParagraph(inner: string, blockToken: string): boolean {
  return inner.trim() === blockToken;
}

/**
 * Split block-level {{placeholders}} onto their own `<p>` lines.
 * Full-width email sections must not share a paragraph with other copy or blocks.
 */
export function normalizeBlockLevelPlaceholdersInHtml(html: string): string {
  return html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    const pAttrs = attrs ?? '';
    const tokenRegex = /\{\{([\w-]+)\}\}/g;
    const matches = [...inner.matchAll(tokenRegex)];
    const blockMatches = matches.filter((m) =>
      isBlockLevelPropertyPlaceholder(normalizePlaceholderKey(m[1]))
    );

    if (blockMatches.length === 0) return match;

    if (blockMatches.length === 1 && isExclusiveBlockParagraph(inner, blockMatches[0][0])) {
      return match;
    }

    const segments: Array<{ kind: 'text'; html: string } | { kind: 'block'; token: string }> = [];
    let cursor = 0;

    for (const m of matches) {
      const key = normalizePlaceholderKey(m[1]);
      const before = inner.slice(cursor, m.index);
      if (before.trim()) {
        segments.push({ kind: 'text', html: before });
      }

      if (isBlockLevelPropertyPlaceholder(key)) {
        segments.push({ kind: 'block', token: placeholderTokenForKey(key) });
      } else {
        const inlineToken = m[0];
        const last = segments[segments.length - 1];
        if (last?.kind === 'text') {
          last.html += inlineToken;
        } else {
          segments.push({ kind: 'text', html: inlineToken });
        }
      }

      cursor = m.index + m[0].length;
    }

    const after = inner.slice(cursor);
    if (after.trim()) {
      segments.push({ kind: 'text', html: after });
    }

    if (segments.length === 0) return match;

    return segments
      .map((seg) =>
        seg.kind === 'block' ? `<p${pAttrs}>${seg.token}</p>` : `<p${pAttrs}>${seg.html}</p>`
      )
      .join('');
  });
}
