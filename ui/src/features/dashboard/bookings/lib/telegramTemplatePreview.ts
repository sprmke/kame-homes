import * as React from 'react';

const TELEGRAM_TOKEN_PATTERN = /(\{\{[^}]+\}\})/g;
const TELEGRAM_TOKEN_TEST = /^\{\{[^}]+\}\}$/;

const TELEGRAM_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW =
  'rounded-sm bg-primary/15 font-mono text-primary';

/** Zero layout impact — must match textarea character width exactly. */
const TELEGRAM_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT =
  'rounded-sm bg-primary/15 text-primary p-0 m-0 shadow-none [box-decoration-break:clone]';

/** Strip trailing line whitespace and collapse runaway blank lines. */
export function normalizeTelegramTemplateText(text: string): string {
  let out = text.replace(/\r\n/g, '\n');
  out = out
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function extractTelegramPlaceholderKey(part: string): string | null {
  if (!TELEGRAM_TOKEN_TEST.test(part)) return null;
  return part.slice(2, -2).trim();
}

function isKnownTelegramPlaceholder(part: string, validKeys?: ReadonlySet<string>): boolean {
  const key = extractTelegramPlaceholderKey(part);
  if (!key) return false;
  if (!validKeys || validKeys.size === 0) return true;
  return validKeys.has(key);
}

export function renderTelegramPlaceholderHighlights(
  text: string,
  keyPrefix = '',
  validKeys?: ReadonlySet<string>,
  variant: 'edit' | 'preview' = 'preview'
): React.ReactNode[] {
  const highlightClass =
    variant === 'edit'
      ? TELEGRAM_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT
      : TELEGRAM_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW;

  return text.split(TELEGRAM_TOKEN_PATTERN).map((part, index) => {
    const key = `${keyPrefix}${index}`;
    if (isKnownTelegramPlaceholder(part, validKeys)) {
      return React.createElement('mark', { key, className: highlightClass }, part);
    }
    return React.createElement(React.Fragment, { key }, part);
  });
}

export function applyTelegramPlaceholders(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}
