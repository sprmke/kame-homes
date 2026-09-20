import DOMPurify, { type Config } from 'dompurify';

/**
 * Rich-text content: host-authored via the tiptap editor. Allowlist covers
 * tiptap's own output tags/marks plus the safe formatting subset editors need.
 * No script/style/iframe/object/embed, no on* handlers, no javascript: URLs
 * (DOMPurify strips these by default regardless of ALLOWED_TAGS).
 */
const RICH_TEXT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'code',
    'pre',
    'hr',
    'span',
    'div',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'colspan', 'rowspan'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  RETURN_TRUSTED_TYPE: false,
};

/** Email HTML snapshots: rendered emails, more permissive on structure but never scripts/forms. */
const EMAIL_SNAPSHOT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'span',
    'div',
    'img',
    'hr',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'center',
    'font',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'class',
    'style',
    'colspan',
    'rowspan',
    'width',
    'height',
    'align',
    'valign',
    'bgcolor',
    'color',
    'border',
    'cellpadding',
    'cellspacing',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Sanitize host-authored rich-text HTML (tiptap output) before rendering with
 * `dangerouslySetInnerHTML`. Doc 22 Phase 22.5 — allowlist-based, not a denylist.
 */
export function sanitizeRichTextHtml(html: string): string {
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG);
}

/**
 * Sanitize a stored email HTML snapshot (e.g. `endorsementEmailSnapshot`)
 * before rendering. Guest-controlled text can flow into these templates via
 * placeholder substitution (CLAUDE.md "Known sharp edges" — placeholder
 * values are attacker-controlled), so this must run at render time even
 * though the email itself was already sent.
 */
export function sanitizeEmailSnapshotHtml(html: string): string {
  return DOMPurify.sanitize(html, EMAIL_SNAPSHOT_CONFIG);
}
