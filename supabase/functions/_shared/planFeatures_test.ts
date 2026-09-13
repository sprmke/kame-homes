import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parsePlanFeatures } from './planFeatures.ts';

Deno.test(
  'parsePlanFeatures inherits aiMarketingImageGeneration from marketingStudio when key is absent',
  () => {
    const features = parsePlanFeatures({
      marketingStudio: true,
      aiMarketingGeneration: false,
    });

    assertEquals(features.marketingStudio, true);
    assertEquals(features.aiMarketingImageGeneration, true);
    assertEquals(features.aiMarketingVideoGeneration, false);
  }
);

Deno.test('parsePlanFeatures keeps aiMarketingImageGeneration false when explicitly set', () => {
  const features = parsePlanFeatures({
    marketingStudio: true,
    aiMarketingImageGeneration: false,
  });

  assertEquals(features.aiMarketingImageGeneration, false);
});

Deno.test(
  'parsePlanFeatures inherits aiMarketingVideoGeneration from aiMarketingGeneration when key is absent',
  () => {
    const features = parsePlanFeatures({
      marketingStudio: true,
      aiMarketingGeneration: true,
    });

    assertEquals(features.aiMarketingImageGeneration, true);
    assertEquals(features.aiMarketingVideoGeneration, true);
  }
);

Deno.test('parsePlanFeatures keeps aiMarketingVideoGeneration false when explicitly set', () => {
  const features = parsePlanFeatures({
    marketingStudio: true,
    aiMarketingGeneration: true,
    aiMarketingVideoGeneration: false,
  });

  assertEquals(features.aiMarketingVideoGeneration, false);
});
