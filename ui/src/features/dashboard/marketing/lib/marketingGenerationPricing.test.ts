/**
 * Parity guard: the client credit table must match the edge one exactly, or the cost
 * shown in the composer is not the cost the host is charged.
 *
 * The edge module is Deno (https imports), so it cannot be imported here — the test
 * reads its source and re-derives the tables instead.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  IMAGE_SIZES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  estimateGenerationCredits,
  type ImageSize,
  type VideoDuration,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

const REPO_ROOT = join(__dirname, '../../../../../..');
const TIERS: MarketingGenerationTier[] = ['draft', 'standard', 'premium'];

function readEdgeSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, 'supabase/functions/_shared', relativePath), 'utf8');
}

/** Both copies round the USD cost to 6dp before converting, so 0.05 * 6 is 0.3, not 0.30000000000000004. */
function roundUsd(costUsd: number): number {
  return Math.round(costUsd * 1_000_000) / 1_000_000;
}

function creditsFromUsd(costUsd: number): number {
  return Math.max(1, Math.ceil(roundUsd(costUsd) / 0.001));
}

/** Pull `tier: { '512px': 0.045, ... }` rows out of the edge IMAGE_COST_USD literal. */
function parseEdgeImageCosts(): Record<string, Record<string, number>> {
  const source = readEdgeSource('marketingGenerationPricing.ts');
  const block = source.slice(
    source.indexOf('const IMAGE_COST_USD'),
    source.indexOf('export function creditsForUsd')
  );
  const table: Record<string, Record<string, number>> = {};
  for (const tier of TIERS) {
    const row = new RegExp(`${tier}:\\s*\\{([^}]*)\\}`).exec(block);
    expect(row, `edge IMAGE_COST_USD is missing ${tier}`).toBeTruthy();
    table[tier] = {};
    for (const [, size, value] of row![1].matchAll(/'([^']+)':\s*([0-9.]+)/g)) {
      table[tier][size] = Number(value);
    }
  }
  return table;
}

/** Pull `usdPerSecondByResolution: { '720p': x, '1080p': y }` out of MARKETING_VIDEO_MODELS. */
function parseEdgeVideoRates(): Record<string, Record<string, number>> {
  const source = readEdgeSource('aiModelRouter.ts');
  const block = source.slice(source.indexOf('export const MARKETING_VIDEO_MODELS'));
  const table: Record<string, Record<string, number>> = {};
  let cursor = 0;
  for (const tier of TIERS) {
    const tierIndex = block.indexOf(`${tier}: {`, cursor);
    expect(tierIndex, `edge MARKETING_VIDEO_MODELS is missing ${tier}`).toBeGreaterThan(-1);
    cursor = tierIndex + 1;
    const rates = /usdPerSecondByResolution:\s*\{([^}]*)\}/.exec(block.slice(tierIndex));
    expect(rates, `edge ${tier} is missing usdPerSecondByResolution`).toBeTruthy();
    table[tier] = {};
    for (const [, resolution, value] of rates![1].matchAll(/'([^']+)':\s*([0-9.]+)/g)) {
      table[tier][resolution] = Number(value);
    }
  }
  return table;
}

describe('marketingGenerationPricing parity', () => {
  it('image credits match the edge cost table', () => {
    const edge = parseEdgeImageCosts();
    for (const tier of TIERS) {
      for (const imageSize of IMAGE_SIZES) {
        expect(
          estimateGenerationCredits({ mediaType: 'image', tier, imageSize: imageSize as ImageSize }),
          `${tier}/${imageSize}`
        ).toBe(creditsFromUsd(edge[tier][imageSize]));
      }
    }
  });

  it('video credits match the edge per-second rates', () => {
    const edge = parseEdgeVideoRates();
    for (const tier of TIERS) {
      for (const resolution of VIDEO_RESOLUTIONS) {
        for (const durationSeconds of VIDEO_DURATIONS) {
          expect(
            estimateGenerationCredits({
              mediaType: 'video',
              tier,
              resolution: resolution as VideoResolution,
              durationSeconds: durationSeconds as VideoDuration,
            }),
            `${tier}/${resolution}/${durationSeconds}s`
          ).toBe(creditsFromUsd(edge[tier][resolution] * durationSeconds));
        }
      }
    }
  });

  it('holds the published defaults', () => {
    expect(estimateGenerationCredits({ mediaType: 'image', tier: 'standard', imageSize: '1K' })).toBe(45);
    expect(
      estimateGenerationCredits({
        mediaType: 'video',
        tier: 'standard',
        resolution: '720p',
        durationSeconds: 8,
      })
    ).toBe(800);
  });
});
