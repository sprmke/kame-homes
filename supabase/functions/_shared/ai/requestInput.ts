/**
 * Request-body validation for AI endpoints. Every AI handler declares its body as a zod schema
 * with explicit length caps, so oversized or malformed input is rejected (400) before any
 * context is loaded or any tokens are spent.
 */

import { z } from 'zod';

import { badRequest } from '../httpResponse.ts';

/** Trimmed string, capped. Empty strings become undefined for optional fields. */
export function boundedText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v.length > 0 ? v : undefined));
}

export function requiredText(max: number) {
  return z.string().trim().min(1, 'Required').max(max, `Must be ${max} characters or fewer`);
}

/** Parses `body` or throws a 400 EdgeError naming the first invalid field. */
export function parseAiRequestBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const field = issue?.path.join('.') || 'body';
  throw badRequest(`${field}: ${issue?.message ?? 'Invalid input'}`, 'invalid_ai_request');
}
