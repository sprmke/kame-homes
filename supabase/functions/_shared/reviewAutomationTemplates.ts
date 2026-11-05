/**
 * Auto-review template tokens and defaults. Pure — no I/O.
 * Tokens: {{guest_first_name}}, {{property_name}}.
 */

import { REVIEW_TEXT_MAX_LEN } from './reviewContentPolicy.ts';

export const AUTO_REVIEW_DELAY_MIN = 1;
export const AUTO_REVIEW_DELAY_MAX = 13;
export const AUTO_REVIEW_MIN_TEMPLATES = 3;

export const DEFAULT_AUTO_REVIEW_TEMPLATES = [
  '{{guest_first_name}} was a pleasure to host at {{property_name}}. Thank you for a smooth stay.',
  'We enjoyed hosting {{guest_first_name}} at {{property_name}}. Welcome back any time.',
  '{{guest_first_name}} took great care of {{property_name}}. We would host again.',
] as const;

const TOKEN_RE = /\{\{\s*(guest_first_name|property_name)\s*\}\}/g;

export function guestFirstName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return 'there';
  const first = trimmed.split(/\s+/)[0];
  return first || 'there';
}

export function applyReviewTemplateTokens(
  template: string,
  vars: { guestFirstName: string; propertyName: string }
): string {
  return template
    .replace(TOKEN_RE, (_match, key: string) =>
      key === 'guest_first_name' ? vars.guestFirstName : vars.propertyName
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAutomationTemplates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.replace(/\s+/g, ' ').trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, REVIEW_TEXT_MAX_LEN));
  }
  return out;
}

export function pickRandomTemplate(templates: string[], random = Math.random): string | null {
  const usable = templates.map((t) => t.trim()).filter(Boolean);
  if (usable.length === 0) return null;
  const index = Math.min(usable.length - 1, Math.floor(random() * usable.length));
  return usable[index] ?? null;
}

export function autoReviewDueAt(opensAtIso: string, delayDays: number): number {
  const days = Math.min(
    AUTO_REVIEW_DELAY_MAX,
    Math.max(AUTO_REVIEW_DELAY_MIN, Math.floor(delayDays))
  );
  return Date.parse(opensAtIso) + days * 86_400_000;
}

export function isAutoReviewDue(opensAtIso: string, delayDays: number, now = new Date()): boolean {
  const due = autoReviewDueAt(opensAtIso, delayDays);
  if (!Number.isFinite(due)) return false;
  return now.getTime() >= due;
}
