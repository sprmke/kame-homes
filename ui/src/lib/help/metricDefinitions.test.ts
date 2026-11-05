import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { collectHelpCopyViolations } from './helpCopyRules';
import { METRIC_DEFINITIONS } from './metricDefinitions';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');

describe('metricDefinitions', () => {
  for (const [key, definition] of Object.entries(METRIC_DEFINITIONS)) {
    it(`${key} follows the copy rules`, () => {
      expect(collectHelpCopyViolations(definition.text, `metricDefinitions.${key}`)).toEqual([]);
    });

    it(`${key} cites a real server symbol`, () => {
      const file = path.join(REPO_ROOT, definition.source.file);
      const contents = readFileSync(file, 'utf8');

      expect(
        contents.includes(definition.source.symbol),
        `${definition.source.file} no longer contains "${definition.source.symbol}"`
      ).toBe(true);
    });
  }

  it('uses a distinct text for every occupancy variant', () => {
    expect(METRIC_DEFINITIONS.propertyOccupancyRate.text).not.toBe(
      METRIC_DEFINITIONS.orgOccupancyRate.text
    );
    expect(METRIC_DEFINITIONS.orgOccupancyRate.text).not.toBe(
      METRIC_DEFINITIONS.parkingOccupancyRate.text
    );
  });
});
