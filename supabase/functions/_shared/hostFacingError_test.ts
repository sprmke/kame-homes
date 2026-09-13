/**
 * Deno tests for _shared/hostFacingError.ts — run with `deno test`.
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  HOST_FACING_BUSY,
  HOST_FACING_GENERATION_FAILED,
  toHostFacingError,
} from './hostFacingError.ts';

const GEMINI_QUOTA_DUMP =
  'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-3.1-flash-image * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image Please retry in 24.474649167s.';

Deno.test('toHostFacingError maps a Gemini quota dump to a short busy line', () => {
  assertEquals(toHostFacingError(GEMINI_QUOTA_DUMP), HOST_FACING_BUSY);
  assertEquals(toHostFacingError(new Error(GEMINI_QUOTA_DUMP)), HOST_FACING_BUSY);
});

Deno.test('toHostFacingError keeps already-friendly generation copy', () => {
  assertEquals(
    toHostFacingError('That prompt was blocked. Try rephrasing.'),
    'That prompt was blocked. Try rephrasing.'
  );
  assertEquals(
    toHostFacingError('This took too long and was stopped.'),
    'This took too long and was stopped.'
  );
});

Deno.test('toHostFacingError uses the generation fallback for empty or HTTP dumps', () => {
  assertEquals(toHostFacingError('', HOST_FACING_GENERATION_FAILED), HOST_FACING_GENERATION_FAILED);
  assertEquals(
    toHostFacingError('Image generation failed (502)', HOST_FACING_GENERATION_FAILED),
    HOST_FACING_GENERATION_FAILED
  );
});
