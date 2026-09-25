/**
 * Redacts guest contact / identity fields from AI artifacts before they are persisted for audit
 * (e.g. dashboard-assistant tool results). Names and booking ids stay so the record is useful;
 * emails, phones, addresses, ID numbers and payment account numbers do not.
 */

const SENSITIVE_KEY_PATTERN =
  /(e-?mail|phone|mobile|contact_?number|address|birth|id_?number|passport|account_?(number|no)|card_?number|gcash|bank_?account|password|secret|_token$|[a-z]Token$|^token$)/i;

const MAX_DEPTH = 8;

export function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveFields(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] =
      SENSITIVE_KEY_PATTERN.test(key) && inner !== null && inner !== ''
        ? '[redacted]'
        : redactSensitiveFields(inner, depth + 1);
  }
  return out;
}
