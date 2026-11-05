/**
 * Copy rules from the `human-copy` skill, enforced over every `*HelpCopy.ts`
 * module. The guard runs in Vitest (Node env) as part of `bun run test`.
 */

const BANNED_PHRASES = [
  'seamless',
  'seamlessly',
  'robust',
  'leverage',
  'empower',
  'unlock',
  'elevate',
  'delight',
  'exciting',
  'powerful',
  'next-level',
  'this lets you',
  'simply',
  'easily',
];

const MAX_COPY_LENGTH = 200;
const DASH_PATTERN = /[\u2013\u2014]/;

function describeValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  return typeof value;
}

function checkString(path: string, value: string): string[] {
  const problems: string[] = [];
  const isHref = path.endsWith('.learnMoreHref');

  if (value.trim() !== value) {
    problems.push(`${path}: leading or trailing whitespace`);
  }
  if (!value.trim()) {
    problems.push(`${path}: empty string`);
    return problems;
  }
  if (DASH_PATTERN.test(value)) {
    problems.push(`${path}: em dash or en dash (${describeValue(value)})`);
  }
  if (!isHref && value.length > MAX_COPY_LENGTH) {
    problems.push(`${path}: ${value.length} characters, max ${MAX_COPY_LENGTH}`);
  }
  if (!isHref) {
    const lower = value.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) {
        problems.push(`${path}: banned phrase "${phrase}" (${describeValue(value)})`);
      }
    }
  }
  return problems;
}

/** Walks one HelpCopy entry (and any nested copy) and returns human-readable problems. */
export function collectHelpCopyViolations(value: unknown, path = 'entry'): string[] {
  if (typeof value === 'string') return checkString(path, value);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectHelpCopyViolations(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const problems: string[] = [];

    for (const [key, child] of Object.entries(record)) {
      problems.push(...collectHelpCopyViolations(child, `${path}.${key}`));
    }

    if ('steps' in record) {
      const steps = record.steps;
      if (!Array.isArray(steps)) {
        problems.push(`${path}.steps: must be an array`);
      } else {
        if (steps.length < 3 || steps.length > 4) {
          problems.push(`${path}.steps: expected 3 or 4 steps, got ${steps.length}`);
        }
        steps.forEach((step, index) => {
          const stepRecord = step as Record<string, unknown> | null;
          if (!stepRecord || typeof stepRecord !== 'object') {
            problems.push(`${path}.steps[${index}]: must be an object`);
            return;
          }
          if (!stepRecord.icon) {
            problems.push(`${path}.steps[${index}].icon: missing Lucide icon`);
          }
          for (const required of ['title', 'body'] as const) {
            const field = stepRecord[required];
            if (typeof field !== 'string' || !field.trim()) {
              problems.push(`${path}.steps[${index}].${required}: required short string`);
            }
          }
        });
      }
    }

    if ('hint' in record && (typeof record.hint !== 'string' || !record.hint.trim())) {
      problems.push(`${path}.hint: required short string`);
    }

    if ('howItWorks' in record) {
      const howItWorks = record.howItWorks;
      if (!howItWorks || typeof howItWorks !== 'object') {
        problems.push(`${path}.howItWorks: must be an object`);
      } else {
        const panel = howItWorks as Record<string, unknown>;
        if (typeof panel.title !== 'string' || !panel.title.trim()) {
          problems.push(`${path}.howItWorks.title: required short string`);
        }
        if (!('steps' in panel)) {
          problems.push(`${path}.howItWorks.steps: required`);
        }
      }
    }

    return problems;
  }

  if (value !== undefined) {
    // Lucide icon components and other non-copy values are expected here.
    return [];
  }
  return [];
}
