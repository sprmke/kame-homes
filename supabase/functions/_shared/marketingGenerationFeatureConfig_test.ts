/**
 * marketingGenerationFeatureConfig — parse/merge of per-property generation overrides.
 * Run: deno test --no-check supabase/functions/_shared/marketingGenerationFeatureConfig_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  MARKETING_IMAGE_GENERATE_FEATURE,
  MARKETING_VIDEO_GENERATE_FEATURE,
  allowPremiumForFeature,
  mergeMarketingGenerationFeatureConfigs,
  monthlyCreditCapForFeature,
  parseMarketingGenerationOverrides,
  parsePositiveIntOrNull,
} from './marketingGenerationFeatureConfig.ts';

Deno.test('parse defaults to no caps and premium off', () => {
  const parsed = parseMarketingGenerationOverrides(null);
  assertEquals(parsed.imageMonthlyCreditCap, null);
  assertEquals(parsed.videoMonthlyCreditCap, null);
  assertEquals(parsed.allowPremiumImage, false);
  assertEquals(parsed.allowPremiumVideo, false);
});

Deno.test('parse reads snake_case JSONB blocks', () => {
  const parsed = parseMarketingGenerationOverrides({
    voice_receptionist: { enabled: true },
    marketing_image_generate: { monthly_credit_cap: 3000, allow_premium_tier: true },
    marketing_video_generate: { monthly_credit_cap: 12000 },
  });
  assertEquals(parsed.imageMonthlyCreditCap, 3000);
  assertEquals(parsed.videoMonthlyCreditCap, 12000);
  assertEquals(parsed.allowPremiumImage, true);
  assertEquals(parsed.allowPremiumVideo, false);
  assertEquals(monthlyCreditCapForFeature(parsed, MARKETING_IMAGE_GENERATE_FEATURE), 3000);
  assertEquals(allowPremiumForFeature(parsed, MARKETING_VIDEO_GENERATE_FEATURE), false);
});

Deno.test('parse ignores non-positive caps', () => {
  const parsed = parseMarketingGenerationOverrides({
    marketing_image_generate: { monthly_credit_cap: 0 },
    marketing_video_generate: { monthly_credit_cap: -8 },
  });
  assertEquals(parsed.imageMonthlyCreditCap, null);
  assertEquals(parsed.videoMonthlyCreditCap, null);
});

Deno.test('merge preserves voice_receptionist and other keys', () => {
  const next = mergeMarketingGenerationFeatureConfigs(
    {
      voice_receptionist: { enabled: true, voice_id: 'Kore' },
      marketing_image_generate: { monthly_credit_cap: 1000 },
    },
    { videoMonthlyCreditCap: 8000, allowPremiumVideo: true }
  );
  assertEquals(next.voice_receptionist, { enabled: true, voice_id: 'Kore' });
  assertEquals(next.marketing_image_generate, { monthly_credit_cap: 1000 });
  assertEquals(next.marketing_video_generate, {
    monthly_credit_cap: 8000,
    allow_premium_tier: true,
  });
});

Deno.test('merge null cap removes the key without dropping premium', () => {
  const next = mergeMarketingGenerationFeatureConfigs(
    {
      marketing_video_generate: { monthly_credit_cap: 8000, allow_premium_tier: true },
    },
    { videoMonthlyCreditCap: null }
  );
  assertEquals(next.marketing_video_generate, { allow_premium_tier: true });
});

Deno.test('merge false premium removes the flag', () => {
  const next = mergeMarketingGenerationFeatureConfigs(
    { marketing_image_generate: { allow_premium_tier: true, monthly_credit_cap: 500 } },
    { allowPremiumImage: false }
  );
  assertEquals(next.marketing_image_generate, { monthly_credit_cap: 500 });
});

Deno.test('parsePositiveIntOrNull accepts blank, rejects zero', () => {
  assertEquals(parsePositiveIntOrNull(undefined, 'cap'), { ok: true, value: undefined });
  assertEquals(parsePositiveIntOrNull('', 'cap'), { ok: true, value: null });
  assertEquals(parsePositiveIntOrNull(12, 'cap'), { ok: true, value: 12 });
  assertEquals(parsePositiveIntOrNull(0, 'cap').ok, false);
});
