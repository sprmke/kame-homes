/**
 * Heuristics for GitHub Project Size / Estimate from backlog item metadata.
 * Used by export + sync scripts. Estimates use Fibonacci story points.
 */

/** @typedef {'XS' | 'S' | 'M' | 'L' | 'XL'} Size */
/** @typedef {'p0' | 'p1' | 'p2' | 'p3' | 'p4'} Priority */

export const SIZE_ORDER = /** @type {const} */ (['XS', 'S', 'M', 'L', 'XL']);

/** @type {Record<Size, number>} */
export const ESTIMATE_BY_SIZE = {
  XS: 1,
  S: 2,
  M: 3,
  L: 5,
  XL: 8,
};

/** @type {Record<Priority, string>} Maps backlog priority → GitHub Project Priority option */
export const PROJECT_PRIORITY_LABEL = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  p4: 'P4',
};

/** @type {Record<Priority, string>} Issue label */
export const PRIORITY_ISSUE_LABEL = {
  p0: 'priority:p0',
  p1: 'priority:p1',
  p2: 'priority:p2',
  p3: 'priority:p3',
  p4: 'priority:p4',
};

const LARGE_KEYWORDS = [
  'cron',
  'migration',
  'oauth',
  'meta app',
  'app review',
  'full sync',
  'full-text',
  'full text',
  'rls',
  'security audit',
  'super admin',
  'partnership',
  'marketplace',
  'subscription',
  'multi-tenant',
  'instagram',
  'tiktok',
  'background',
  'intelligence',
  'broadcast',
  'orchestr',
  'stepper',
  'ai validation',
  'ai property',
  'encryption',
  'webhook',
  'sentry',
  'catalog api',
  'reverification',
  'governance',
  'e2e',
];

const SMALL_KEYWORDS = [
  'layout',
  'copy',
  ' label',
  'slug',
  'one row',
  'colors',
  'colour',
  'modal spacing',
  'tooltip',
  'placeholder',
  'footer',
  'rename',
  'polish',
  'spacing',
  'validation review',
  'explainer',
  'copy-to-clipboard',
  'minimum 3',
  'level field',
];

/**
 * @param {Size} size
 * @param {number} steps
 * @returns {Size}
 */
export function bumpSize(size, steps) {
  const i = SIZE_ORDER.indexOf(size);
  const next = Math.min(SIZE_ORDER.length - 1, Math.max(0, i + steps));
  return SIZE_ORDER[next];
}

/**
 * @param {{
 *   title: string;
 *   body?: string;
 *   type?: string;
 *   priority?: string | null;
 *   modules?: string[];
 *   blockedBy?: unknown[];
 *   dependsOn?: unknown[];
 *   isEpic?: boolean;
 *   sectionId?: string;
 * }} item
 */
export function computeIssueMetadata(item) {
  const title = item.title.toLowerCase();
  const body = (item.body ?? '').toLowerCase();
  const text = `${title} ${body}`;

  /** @type {Priority} */
  let priority = 'p2';
  if (item.priority && /^p[0-4]$/.test(item.priority)) {
    priority = /** @type {Priority} */ (item.priority);
  } else if (item.isEpic) {
    priority = 'p1';
  }

  /** @type {Size} */
  let size = 'S';

  if (item.isEpic) {
    size = 'XL';
  } else {
    switch (item.type) {
      case 'epic':
        size = 'XL';
        break;
      case 'feature':
        size = 'M';
        break;
      case 'enhancement':
        size = 'S';
        break;
      case 'bug':
        size = 'S';
        break;
      case 'ops':
        size = 'S';
        break;
      case 'security':
        size = 'M';
        break;
      case 'content':
        size = 'XS';
        break;
      case 'tech-debt':
        size = 'S';
        break;
      case 'breaking':
        size = 'L';
        break;
      default:
        size = 'M';
    }

    if (LARGE_KEYWORDS.some((k) => text.includes(k))) {
      size = bumpSize(size, 1);
    }
    if (SMALL_KEYWORDS.some((k) => text.includes(k))) {
      size = bumpSize(size, -1);
    }
    if ((item.modules?.length ?? 0) > 2) {
      size = bumpSize(size, 1);
    }
    if ((item.dependsOn?.length ?? 0) > 0) {
      size = bumpSize(size, 1);
    }
    if (priority === 'p0' && size === 'S') {
      size = 'M';
    }
    if (priority === 'p0' && size === 'M') {
      size = 'L';
    }
  }

  const typeLabel = item.isEpic ? 'type:epic' : `type:${item.type ?? 'feature'}`;
  const moduleLabels = item.isEpic
    ? []
    : (item.modules ?? []).map((m) => `module:${m}`);

  return {
    priority,
    projectPriority: PROJECT_PRIORITY_LABEL[priority],
    priorityLabel: PRIORITY_ISSUE_LABEL[priority],
    size,
    estimate: ESTIMATE_BY_SIZE[size],
    typeLabel,
    moduleLabels,
  };
}

/**
 * @param {number[]} childEstimates
 */
export function epicEstimate(childEstimates) {
  const sum = childEstimates.reduce((a, b) => a + b, 0);
  return Math.max(8, sum);
}
