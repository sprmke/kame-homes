/**
 * Pure auto-review rules: defaults, parse, DTO, skip-tag checks. No I/O.
 */

import { GUEST_REVIEW_CONSTRUCTIVE_TAG_IDS } from './guestReviewFeedbackTags.ts';
import { REVIEW_TEXT_MAX_LEN, validateReviewText } from './reviewContentPolicy.ts';
import {
  AUTO_REVIEW_DELAY_MAX,
  AUTO_REVIEW_DELAY_MIN,
  AUTO_REVIEW_MIN_TEMPLATES,
  DEFAULT_AUTO_REVIEW_TEMPLATES,
  normalizeAutomationTemplates,
} from './reviewAutomationTemplates.ts';

const CONSTRUCTIVE = new Set<string>(GUEST_REVIEW_CONSTRUCTIVE_TAG_IDS);

export type ReviewAutomationRules = {
  propertyId: string;
  organizationId: string;
  enabled: boolean;
  delayDays: number;
  overallRating: number;
  cleanlinessRating: number;
  communicationRating: number;
  houseRulesRating: number;
  wouldHostAgain: boolean;
  templates: string[];
  skipOnIssueTags: boolean;
  skipOnOpenMaintenance: boolean;
  skipOnSdDeduction: boolean;
};

export const DEFAULT_REVIEW_AUTOMATION_RULES: Omit<
  ReviewAutomationRules,
  'propertyId' | 'organizationId'
> = {
  enabled: false,
  delayDays: 3,
  overallRating: 5,
  cleanlinessRating: 5,
  communicationRating: 5,
  houseRulesRating: 5,
  wouldHostAgain: true,
  templates: [...DEFAULT_AUTO_REVIEW_TEMPLATES],
  skipOnIssueTags: true,
  skipOnOpenMaintenance: true,
  skipOnSdDeduction: true,
};

function clampRating(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    return fallback;
  }
  return value;
}

function clampDelay(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;
  return Math.min(AUTO_REVIEW_DELAY_MAX, Math.max(AUTO_REVIEW_DELAY_MIN, value));
}

export function parseAutomationRulesBody(
  body: Record<string, unknown>,
  fallback: Omit<ReviewAutomationRules, 'propertyId' | 'organizationId'>
): Omit<ReviewAutomationRules, 'propertyId' | 'organizationId'> | { error: string } {
  const enabled = body.enabled === true;
  const templates = normalizeAutomationTemplates(body.templates);
  if (enabled && templates.length < AUTO_REVIEW_MIN_TEMPLATES) {
    return { error: `Add at least ${AUTO_REVIEW_MIN_TEMPLATES} review templates` };
  }
  for (const template of templates) {
    const err = validateReviewText(template, { maxLen: REVIEW_TEXT_MAX_LEN });
    if (err) return { error: err };
  }
  return {
    enabled,
    delayDays: clampDelay(body.delayDays, fallback.delayDays),
    overallRating: clampRating(body.overallRating, fallback.overallRating),
    cleanlinessRating: clampRating(body.cleanlinessRating, fallback.cleanlinessRating),
    communicationRating: clampRating(body.communicationRating, fallback.communicationRating),
    houseRulesRating: clampRating(body.houseRulesRating, fallback.houseRulesRating),
    wouldHostAgain: typeof body.wouldHostAgain === 'boolean' ? body.wouldHostAgain : true,
    templates: templates.length >= AUTO_REVIEW_MIN_TEMPLATES ? templates : [...fallback.templates],
    skipOnIssueTags: body.skipOnIssueTags !== false,
    skipOnOpenMaintenance: body.skipOnOpenMaintenance !== false,
    skipOnSdDeduction: body.skipOnSdDeduction !== false,
  };
}

export function rowToRules(row: Record<string, unknown>): ReviewAutomationRules {
  return {
    propertyId: String(row.property_id),
    organizationId: String(row.organization_id),
    enabled: row.enabled === true,
    delayDays: clampDelay(row.delay_days, 3),
    overallRating: clampRating(row.overall_rating, 5),
    cleanlinessRating: clampRating(row.cleanliness_rating, 5),
    communicationRating: clampRating(row.communication_rating, 5),
    houseRulesRating: clampRating(row.house_rules_rating, 5),
    wouldHostAgain: row.would_host_again !== false,
    templates: normalizeAutomationTemplates(row.templates),
    skipOnIssueTags: row.skip_on_issue_tags !== false,
    skipOnOpenMaintenance: row.skip_on_open_maintenance !== false,
    skipOnSdDeduction: row.skip_on_sd_deduction !== false,
  };
}

export function toAutomationRulesDto(
  rules: Pick<
    ReviewAutomationRules,
    | 'enabled'
    | 'delayDays'
    | 'overallRating'
    | 'cleanlinessRating'
    | 'communicationRating'
    | 'houseRulesRating'
    | 'wouldHostAgain'
    | 'templates'
    | 'skipOnIssueTags'
    | 'skipOnOpenMaintenance'
    | 'skipOnSdDeduction'
  >
) {
  return {
    enabled: rules.enabled,
    delayDays: rules.delayDays,
    overallRating: rules.overallRating,
    cleanlinessRating: rules.cleanlinessRating,
    communicationRating: rules.communicationRating,
    houseRulesRating: rules.houseRulesRating,
    wouldHostAgain: rules.wouldHostAgain,
    templates:
      rules.templates.length >= AUTO_REVIEW_MIN_TEMPLATES
        ? rules.templates
        : [...DEFAULT_AUTO_REVIEW_TEMPLATES],
    skipOnIssueTags: rules.skipOnIssueTags,
    skipOnOpenMaintenance: rules.skipOnOpenMaintenance,
    skipOnSdDeduction: rules.skipOnSdDeduction,
  };
}

export function hasIssueTags(feedbackTags: unknown, starRating: unknown): boolean {
  if (typeof starRating === 'number' && starRating <= 3) return true;
  if (!Array.isArray(feedbackTags)) return false;
  return feedbackTags.some((tag) => typeof tag === 'string' && CONSTRUCTIVE.has(tag));
}
