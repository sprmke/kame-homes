import { createElement } from 'react';

import { renderToString } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { useShowcaseEmbla } from '@/features/guest/marketing/showcase/hooks/useShowcaseEmbla';

function Probe() {
  useShowcaseEmbla({ align: 'start', loop: false });
  return createElement('div', null, 'ok');
}

describe('useShowcaseEmbla', () => {
  it('runs on the app React dispatcher', () => {
    expect(renderToString(createElement(Probe))).toContain('ok');
  });
});
