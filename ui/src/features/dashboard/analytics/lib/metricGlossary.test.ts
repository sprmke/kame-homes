import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { collectHelpCopyViolations } from '@/lib/help/helpCopyRules';

import { ANALYTICS_METRIC_GLOSSARY, type AnalyticsMetricKey } from './metricGlossary';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../../../..');
const EDGE_FILE = path.join(
  REPO_ROOT,
  'supabase/functions/_shared/dashboardAssistantAnalyticsTools.ts'
);

/** UI camelCase key -> edge snake_case key. */
const EDGE_KEY: Record<AnalyticsMetricKey, string> = {
  forwardOccupancy: 'forward_occupancy_state',
  occupancy: 'occupancy',
  adr: 'adr',
  revpar: 'revpar',
  reservations: 'reservations',
  leadTime: 'lead_time',
  cancellationRate: 'cancellation_rate',
  rating: 'rating',
  responseRate: 'response_rate',
  occupancyOnBooks: 'occupancy_on_books',
  revenueOnBooks: 'revenue',
  pickup: 'pickup',
};

function edgeMetricKeys(): Set<string> {
  const source = readFileSync(EDGE_FILE, 'utf8');
  const block = source.match(/const METRIC_EXPLANATIONS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('METRIC_EXPLANATIONS block not found');

  const keys = new Set<string>();
  for (const match of block[1].matchAll(/^\s{2}([a-z_]+):/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

describe('analytics metric glossary', () => {
  it('covers every UI metric', () => {
    expect(Object.keys(ANALYTICS_METRIC_GLOSSARY).sort()).toEqual(Object.keys(EDGE_KEY).sort());
  });

  it('maps every UI metric to an edge explanation', () => {
    const keys = edgeMetricKeys();
    for (const [uiKey, edgeKey] of Object.entries(EDGE_KEY)) {
      expect(keys.has(edgeKey), `${uiKey} -> ${edgeKey} is missing on the edge`).toBe(true);
    }
  });

  it('follows the copy rules', () => {
    for (const [key, text] of Object.entries(ANALYTICS_METRIC_GLOSSARY)) {
      expect(collectHelpCopyViolations(text, `ANALYTICS_METRIC_GLOSSARY.${key}`)).toEqual([]);
    }
  });
});
