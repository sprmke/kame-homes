import { describe, expect, it } from 'vitest';

import { collectHelpCopyViolations } from './helpCopyRules';

/**
 * Every feature module keeps its help strings in a `*HelpCopy.ts` file. This
 * guard scans them all so copy cannot drift past the `human-copy` rules.
 *
 * `.test.tsx` files are not part of the Vitest include list, which is why this
 * lives in a plain `.ts` file.
 */
const copyModules = import.meta.glob<Record<string, unknown>>('../../**/*HelpCopy.ts', {
  eager: true,
});

const icon = () => null;

const validEntry = {
  hint: 'Lowest price Smart Pricing can set for any night.',
  howItWorks: {
    title: 'How Smart Pricing works',
    steps: [
      { icon, title: 'Start with your rates', body: 'Your saved base and weekend rates.' },
      { icon, title: 'Check demand', body: 'Day of week, season, and how fast nights sell.' },
      { icon, title: 'Stay in bounds', body: 'Never past your price limits.' },
    ],
    tip: 'Booked nights are never changed.',
    learnMoreHref: '/support/help/smart-pricing',
  },
};

describe('help copy guard', () => {
  it('accepts a valid entry', () => {
    expect(collectHelpCopyViolations(validEntry)).toEqual([]);
  });

  it('rejects em dashes, long hints, empty copy, and banned phrases', () => {
    const problems = collectHelpCopyViolations({
      hint: `This is a seamlessly robust hint with an em dash \u2014 and ${'x'.repeat(200)}`,
      howItWorks: {
        title: '',
        steps: [
          { icon, title: 'One', body: 'Easily done.' },
          { icon, title: '', body: 'Two' },
        ],
      },
    });
    const joined = problems.join('\n');

    expect(joined).toContain('em dash or en dash');
    expect(joined).toContain('characters, max 200');
    expect(joined).toContain('banned phrase "seamlessly"');
    expect(joined).toContain('banned phrase "robust"');
    expect(joined).toContain('banned phrase "easily"');
    expect(joined).toContain('empty string');
    expect(joined).toContain('expected 3 or 4 steps, got 2');
  });

  it('requires three or four steps with a title and body each', () => {
    const problems = collectHelpCopyViolations({
      howItWorks: {
        title: 'How it works',
        steps: [
          { icon, title: 'One', body: '' },
          { icon, title: 'Two', body: 'Two' },
          { icon, title: 'Three', body: 'Three' },
        ],
      },
    });

    expect(problems).toContain('entry.howItWorks.steps[0].body: required short string');
  });

  it('every *HelpCopy.ts module follows the copy rules', () => {
    const problems: string[] = [];

    for (const [file, module] of Object.entries(copyModules)) {
      for (const [exportName, value] of Object.entries(module)) {
        if (exportName === 'default') continue;
        problems.push(...collectHelpCopyViolations(value, `${file}#${exportName}`));
      }
    }

    expect(problems, problems.join('\n')).toEqual([]);
  });
});
