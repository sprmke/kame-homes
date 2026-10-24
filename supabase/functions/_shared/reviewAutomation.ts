/**
 * Auto-review of guests after check-out. Plan-gated `reviewAutomation`.
 * Skip when the stay has issue tags, open maintenance, or an SD deduction.
 */

import { normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { createServiceClient } from './orgAuth.ts';
import { shouldSkipForCutoverWatermark } from './cutoverWatermark.ts';
import { getPlatformSettingsSnapshot } from './platformSettingsCache.ts';
import { guestIdentityKey } from './guestIdentityKey.ts';
import { getHostGuestReviewRow, upsertHostGuestReview } from './hostGuestReviewService.ts';
import { isFeatureEnabled } from './planFeatures.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';
import { publishIfComplete } from './reviewPublishing.ts';
import {
  applyReviewTemplateTokens,
  guestFirstName,
  isAutoReviewDue,
  pickRandomTemplate,
} from './reviewAutomationTemplates.ts';
import {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  hasIssueTags,
  rowToRules,
  toAutomationRulesDto,
  type ReviewAutomationRules,
} from './reviewAutomationRules.ts';
import { REVIEW_TEXT_MAX_LEN, validateReviewText } from './reviewContentPolicy.ts';

export {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  hasIssueTags,
  parseAutomationRulesBody,
  toAutomationRulesDto,
  type ReviewAutomationRules,
} from './reviewAutomationRules.ts';

export async function getReviewAutomationRules(
  propertyId: string
): Promise<ReturnType<typeof toAutomationRulesDto>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('review_automation_rules')
    .select(
      'property_id, organization_id, enabled, delay_days, overall_rating, cleanliness_rating, communication_rating, house_rules_rating, would_host_again, templates, skip_on_issue_tags, skip_on_open_maintenance, skip_on_sd_deduction'
    )
    .eq('property_id', propertyId)
    .maybeSingle();
  if (!data) return toAutomationRulesDto(DEFAULT_REVIEW_AUTOMATION_RULES);
  return toAutomationRulesDto(rowToRules(data as Record<string, unknown>));
}

export async function upsertReviewAutomationRules(input: {
  propertyId: string;
  organizationId: string;
  authorUserId: string | null;
  rules: Omit<ReviewAutomationRules, 'propertyId' | 'organizationId'>;
}): Promise<ReturnType<typeof toAutomationRulesDto>> {
  const supabase = createServiceClient();
  const payload = {
    property_id: input.propertyId,
    organization_id: input.organizationId,
    enabled: input.rules.enabled,
    delay_days: input.rules.delayDays,
    overall_rating: input.rules.overallRating,
    cleanliness_rating: input.rules.cleanlinessRating,
    communication_rating: input.rules.communicationRating,
    house_rules_rating: input.rules.houseRulesRating,
    would_host_again: input.rules.wouldHostAgain,
    templates: input.rules.templates,
    skip_on_issue_tags: input.rules.skipOnIssueTags,
    skip_on_open_maintenance: input.rules.skipOnOpenMaintenance,
    skip_on_sd_deduction: input.rules.skipOnSdDeduction,
    updated_at: new Date().toISOString(),
    updated_by: input.authorUserId,
  };
  const { error } = await supabase
    .from('review_automation_rules')
    .upsert(payload, { onConflict: 'property_id' });
  if (error) throw new Error(error.message);
  return toAutomationRulesDto(input.rules);
}

export async function setAutoReviewPaused(bookingId: string, paused: boolean): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('booking_review_windows')
    .update({ auto_review_paused: paused })
    .eq('booking_id', bookingId);
  if (error) throw new Error(error.message);
}

async function shouldSkipAutoReview(
  rules: ReviewAutomationRules,
  booking: Record<string, unknown>
): Promise<string | null> {
  const supabase = createServiceClient();
  const bookingId = String(booking.id);

  if (rules.skipOnIssueTags) {
    const { data: guestReview } = await supabase
      .from('guest_reviews')
      .select('star_rating, feedback_tags')
      .eq('booking_id', bookingId)
      .neq('status', 'removed')
      .maybeSingle();
    if (guestReview && hasIssueTags(guestReview.feedback_tags, guestReview.star_rating)) {
      return 'issue_tags';
    }
  }

  if (rules.skipOnSdDeduction) {
    const expected = Number(booking.security_deposit ?? 0);
    const refunded = booking.sd_refund_amount;
    if (
      refunded != null &&
      expected > 0 &&
      Number.isFinite(Number(refunded)) &&
      Number(refunded) + 0.009 < expected
    ) {
      return 'sd_deduction';
    }
  }

  if (rules.skipOnOpenMaintenance) {
    const propertyId = String(booking.property_id ?? rules.propertyId);
    const checkIn = normalizeBookingDateToYmd(String(booking.check_in_date ?? '')) ?? '';
    const checkOut = normalizeBookingDateToYmd(String(booking.check_out_date ?? '')) ?? '';
    let query = supabase
      .from('maintenance_items')
      .select('id')
      .eq('property_id', propertyId)
      .is('completed_at', null)
      .limit(1);
    if (checkIn && checkOut) {
      query = query.gte('scheduled_on', checkIn).lte('scheduled_on', checkOut);
    }
    const { data: openItems } = await query;
    if ((openItems ?? []).length > 0) return 'open_maintenance';
  }

  return null;
}

export type AutoReviewStats = {
  autoReviewsSubmitted: number;
  autoReviewsSkipped: number;
};

export type AutoReviewOutcome = 'submitted' | 'skipped';

export async function runAutoReviews(
  now = new Date(),
  onOutcome?: (organizationId: string, outcome: AutoReviewOutcome) => void
): Promise<AutoReviewStats> {
  const stats: AutoReviewStats = { autoReviewsSubmitted: 0, autoReviewsSkipped: 0 };
  const record = (organizationId: string, outcome: AutoReviewOutcome) => {
    if (outcome === 'submitted') stats.autoReviewsSubmitted += 1;
    else stats.autoReviewsSkipped += 1;
    onOutcome?.(organizationId, outcome);
  };
  const supabase = createServiceClient();
  const { data: ruleRows } = await supabase
    .from('review_automation_rules')
    .select(
      'property_id, organization_id, enabled, delay_days, overall_rating, cleanliness_rating, communication_rating, house_rules_rating, would_host_again, templates, skip_on_issue_tags, skip_on_open_maintenance, skip_on_sd_deduction'
    )
    .eq('enabled', true)
    .limit(500);
  if (!ruleRows?.length) return stats;

  for (const raw of ruleRows) {
    const rules = rowToRules(raw as Record<string, unknown>);
    try {
      const entitlements = await resolvePropertyEntitlements(rules.propertyId);
      if (!isFeatureEnabled(entitlements, 'reviewAutomation')) continue;
    } catch {
      continue;
    }

    const { data: windows } = await supabase
      .from('booking_review_windows')
      .select('booking_id, opens_at, closes_at, published_at, auto_review_paused')
      .eq('property_id', rules.propertyId)
      .is('published_at', null)
      .eq('auto_review_paused', false)
      .is('auto_review_skipped_reason', null)
      .lte('opens_at', now.toISOString())
      .gte('closes_at', now.toISOString())
      .limit(200);

    for (const window of windows ?? []) {
      if (!isAutoReviewDue(String(window.opens_at), rules.delayDays, now)) continue;
      const bookingId = String(window.booking_id);
      const existing = await getHostGuestReviewRow(bookingId);
      if (existing) continue;

      const { data: booking } = await supabase
        .from('guest_submissions')
        .select(
          'id, property_id, guest_email, guest_user_id, primary_guest_name, guest_facebook_name, check_in_date, check_out_date, security_deposit, sd_refund_amount, status'
        )
        .eq('id', bookingId)
        .maybeSingle();
      if (!booking) continue;
      if (booking.status === 'CANCELLED') continue;
      if (
        shouldSkipForCutoverWatermark(
          booking.check_out_date as string | null,
          await getPlatformSettingsSnapshot().then((s) => s.migrationCutoverAt)
        )
      ) {
        await skip('cutover_watermark');
        continue;
      }

      const skip = async (reason: string) => {
        const { error } = await supabase
          .from('booking_review_windows')
          .update({ auto_review_skipped_reason: reason })
          .eq('booking_id', bookingId);
        if (error) console.warn('[reviewAutomation] skip mark failed:', bookingId, error.message);
        record(rules.organizationId, 'skipped');
      };

      const skipReason = await shouldSkipAutoReview(rules, booking as Record<string, unknown>);
      if (skipReason) {
        await skip(skipReason);
        continue;
      }

      const { data: property } = await supabase
        .from('properties')
        .select('name')
        .eq('id', rules.propertyId)
        .maybeSingle();

      const template = pickRandomTemplate(rules.templates);
      if (!template) {
        await skip('no_template');
        continue;
      }
      const guestName =
        (booking.primary_guest_name as string | null)?.trim() ||
        (booking.guest_facebook_name as string | null)?.trim() ||
        null;
      const reviewText = applyReviewTemplateTokens(template, {
        guestFirstName: guestFirstName(guestName),
        propertyName: (property?.name as string | null)?.trim() || 'the property',
      });
      const textErr = validateReviewText(reviewText, { maxLen: REVIEW_TEXT_MAX_LEN });
      if (textErr) {
        await skip('invalid_template');
        continue;
      }

      const identityKey = await guestIdentityKey(
        (booking.guest_email as string | null) ?? null,
        bookingId
      );
      const result = await upsertHostGuestReview({
        bookingId,
        propertyId: rules.propertyId,
        organizationId: rules.organizationId,
        guestUserId: (booking.guest_user_id as string | null) ?? null,
        guestIdentityKey: identityKey,
        overallRating: rules.overallRating,
        cleanlinessRating: rules.cleanlinessRating,
        communicationRating: rules.communicationRating,
        houseRulesRating: rules.houseRulesRating,
        wouldHostAgain: rules.wouldHostAgain,
        strengthTags: rules.overallRating >= 4 ? ['would_host_again'] : [],
        issueTags: [],
        reviewText,
        privateNote: null,
        internalNote: 'Auto-review',
        authorUserId: null,
      });
      if (!result.ok) continue;
      await publishIfComplete(bookingId);
      record(rules.organizationId, 'submitted');
    }
  }

  return stats;
}
