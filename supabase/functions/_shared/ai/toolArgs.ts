/**
 * Server-side validation of model-proposed tool arguments against the tool's own declared JSON
 * schema (the subset Gemini function declarations use). The declaration sent to the model is a
 * hint, not a guarantee — this is what actually gates execution. Declared keys with wrong types,
 * enum values or oversized values are rejected (never coerced to defaults); undeclared keys pass
 * through unchanged for tools that read legacy aliases.
 */

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: readonly unknown[];
};

export type ToolArgsValidation =
  { ok: true; args: Record<string, unknown> } | { ok: false; error: string };

/** Bounds a single string argument so one field cannot flood downstream prompts or queries. */
const MAX_STRING_ARG_CHARS = 8_000;
const MAX_ARRAY_ARG_ITEMS = 100;

function validateValue(
  schema: JsonSchema,
  value: unknown,
  path: string
): { value: unknown } | { error: string } {
  if (schema.enum && !schema.enum.includes(value)) {
    return { error: `${path} must be one of: ${schema.enum.join(', ')}` };
  }
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return { error: `${path} must be a string` };
      if (value.length > MAX_STRING_ARG_CHARS) return { error: `${path} is too long` };
      return { value };
    case 'number':
    case 'integer': {
      // Models occasionally emit numeric strings; accept only clean numbers, never junk → 0.
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n))
        return { error: `${path} must be a number` };
      if (schema.type === 'integer' && !Number.isInteger(n))
        return { error: `${path} must be a whole number` };
      return { value: n };
    }
    case 'boolean':
      if (typeof value !== 'boolean') return { error: `${path} must be true or false` };
      return { value };
    case 'array': {
      if (!Array.isArray(value)) return { error: `${path} must be a list` };
      if (value.length > MAX_ARRAY_ARG_ITEMS) return { error: `${path} has too many items` };
      if (!schema.items) return { value };
      const out: unknown[] = [];
      for (const [i, item] of value.entries()) {
        const r = validateValue(schema.items, item, `${path}[${i}]`);
        if ('error' in r) return r;
        out.push(r.value);
      }
      return { value: out };
    }
    case 'object':
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { error: `${path} must be an object` };
      }
      return schema.properties
        ? validateObject(schema, value as Record<string, unknown>, path)
        : { value };
    default:
      return { value };
  }
}

function validateObject(
  schema: JsonSchema,
  input: Record<string, unknown>,
  path: string
): { value: Record<string, unknown> } | { error: string } {
  const properties = schema.properties ?? {};
  const out: Record<string, unknown> = { ...input };
  for (const [key, propSchema] of Object.entries(properties)) {
    const raw = input[key];
    if (raw === undefined || raw === null) continue;
    const r = validateValue(propSchema, raw, path ? `${path}.${key}` : key);
    if ('error' in r) return r;
    out[key] = r.value;
  }
  // `required` is intentionally not enforced here: several tools fall back to the page context
  // (e.g. the booking being viewed) when the model omits an id, and report their own
  // missing-argument errors. This layer guards types, enums and sizes of what *was* sent.
  return { value: out };
}

export function validateToolArgs(parameters: unknown, args: unknown): ToolArgsValidation {
  if (args !== undefined && args !== null && (typeof args !== 'object' || Array.isArray(args))) {
    return { ok: false, error: 'Tool arguments must be an object' };
  }
  const schema = (parameters ?? {}) as JsonSchema;
  if (schema.type && schema.type !== 'object')
    return { ok: true, args: (args ?? {}) as Record<string, unknown> };
  const r = validateObject(schema, (args ?? {}) as Record<string, unknown>, '');
  return 'error' in r
    ? { ok: false, error: `Invalid tool arguments: ${r.error}` }
    : { ok: true, args: r.value };
}
