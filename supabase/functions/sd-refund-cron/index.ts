/**
 * sd-refund-cron — Phase 4 scheduled edge function.
 *
 * Purpose:  Scan for bookings in `READY_FOR_CHECKIN` where wall-clock **now** (Asia/Manila) is **on or after**
 *           `check_out_date` + `check_out_time` **minus** a configurable **lead** (default **120 minutes**).
 *           **Check-out & SD Refund Details email** to the guest runs on that schedule **without** requiring
 *           final guest-balance settlement (idempotent via `sd_refund_form_emailed_at`).
 *           **Status** `READY_FOR_CHECKIN` → `READY_FOR_CHECKOUT` still runs **only** when settlement is complete
 *           (paid = total guest balance; receipt URL when total > ₱0), via `WorkflowOrchestrator` (calendar/sheet; SD email on
 *           transition is skipped if the guest was already emailed in this phase).
 *
 * Trigger:  Supabase cron — every 5 minutes (POST with empty or `{}` body — processes all candidates).
 *
 * Scoped admin runs:
 *   POST JSON `{ "bookingId": "<uuid>" }` with a valid **admin** JWT (`verifyAdminJwt`).
 *   Only that booking is evaluated (same due + settlement rules). Prevents one admin click
 *   from transitioning unrelated `READY_FOR_CHECKIN` rows.
 *
 * Email guard (stale check-outs):
 *   If check-out is older than `SD_REFUND_CRON_MAX_CHECKOUT_AGE_DAYS` (default 30; set `0` to disable),
 *   the cron **does not** send the check-out email and passes **`sendSdRefundFormEmail: false`** on transition
 *   so guests who departed long ago are not surprised. Email side effects still run when the transition fires.
 *
 * Idempotency:
 *   - The status machine (`canTransition`) prevents re-processing: a booking
 *     already moved to `READY_FOR_CHECKOUT` (or beyond) is no longer a candidate.
 *   - Safe to run multiple times; re-entrant — only READY_FOR_CHECKIN rows are touched.
 *
 * Timezone:  Asia/Manila (UTC+8) for all wall-clock comparisons (Q7.1).
 *
 * Lead window:  minutes **before** parsed check-out (Manila) when the booking becomes eligible
 *               (env: `SD_REFUND_CRON_EMAIL_LEAD_MINUTES`, default **120**).
 *
 * Reference:  docs/planning/NEW_FLOW_PLAN.md §5 Phase 4, §6.1 Q7.1
 *             .cursor/rules/booking-workflow.mdc §3
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { resolveAppSettings } from '../_shared/appSettings.ts';
import {
  resolveScopedPropertyAccess,
  verifyBookingBelongsToProperty,
} from '../_shared/propertyScope.ts';
import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { checkGuestBalanceSettlement } from '../_shared/totalGuestBalance.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { sendSdRefundFormRequest } from '../_shared/emailService.ts';
import { propertyAutomationEnabled } from '../_shared/propertyAutomationToggles.ts';
import { capturePostHogException } from '../_shared/posthog.ts';
import { evaluateSdRefundLeadWindow, parseCheckoutManila } from '../_shared/sdRefundCronLead.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';

const MANILA_TZ = 'Asia/Manila';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Guards the unscoped global-sweep path (empty/`{}` body — no `bookingId`, no admin JWT).
 * Same fail-open-until-configured convention as every other scheduled cron in this repo
 * (`verifyParkingBroadcastExpireCronSecret`, `verifyContractExpiryCronSecret`, Telegram
 * crons, etc.) — if the operator hasn't set `SD_REFUND_CRON_SECRET` yet, the sweep keeps
 * working exactly as before; once set, only the pg_cron job's Vault-sourced header
 * (`sync_sd_refund_cron_job` migration) or another caller who knows the secret can trigger it.
 * Production (`ENVIRONMENT=production`) rejects when the secret is unset.
 */
function verifySdRefundCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'SD_REFUND_CRON_SECRET',
    headerName: 'x-sd-refund-cron-secret',
  });
}

// ─── Date/time helpers ─────────────────────────────────────────────────────────

/**
 * Returns current wall-clock time in Asia/Manila as a Date object.
 */
function nowManila(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MANILA_TZ }));
}

/**
 * Returns the default check-out time fallback (11:00 AM Manila).
 */
function defaultCheckoutTime(): string {
  return '11:00 AM';
}

/** Same rules as WorkflowOrchestrator for RFCI → READY_FOR_CHECKOUT (paid = total; receipt if total > 0). */
function canAutoTransitionWithSettlement(row: Record<string, unknown>):
  | {
      ok: true;
    }
  | { ok: false; reason: string } {
  const result = checkGuestBalanceSettlement(row);
  if (!result.ok) return result;
  return { ok: true };
}

// ─── DB helper ─────────────────────────────────────────────────────────────────

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

const SELECT_COLUMNS =
  'id, property_id, check_in_date, check_out_date, check_out_time, guest_facebook_name, guest_email, booking_rate, down_payment, security_deposit, pet_fee, parking_rate_guest, guest_additional_fee, guest_balance_paid_amount, guest_balance_payment_receipt_url, sd_refund_form_emailed_at';

type CronResultRow = {
  bookingId: string;
  action: string;
  reason?: string;
  sdRefundFormEmailSent?: boolean;
};

async function parseOptionalBookingId(req: Request): Promise<string | undefined> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return undefined;
  try {
    const body = (await req.json()) as { bookingId?: unknown };
    if (typeof body?.bookingId === 'string' && body.bookingId.trim()) {
      return body.bookingId.trim();
    }
  } catch {
    // empty body
  }
  return undefined;
}

// ─── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  const runStarted = new Date().toISOString();
  console.log('[sd-refund-cron] Run started at', runStarted);

  try {
    const scopedBookingId = await parseOptionalBookingId(req);
    let scoped = false;
    let adminPropertyId: string | null = null;

    if (scopedBookingId) {
      if (!UUID_RE.test(scopedBookingId)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid bookingId (expected UUID)' }),
          { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
      const scopedBooking = await DatabaseService.getBookingById(scopedBookingId);
      const scopedPropertyId = (scopedBooking?.property_id as string | undefined)?.trim();
      if (!scopedPropertyId) {
        return new Response(JSON.stringify({ success: false, error: 'Booking not found' }), {
          status: 404,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      const { property } = await resolveScopedPropertyAccess(
        req,
        'bookings.detail.workflow:edit',
        scopedPropertyId
      );
      adminPropertyId = property.id;
      await verifyBookingBelongsToProperty(scopedBookingId, adminPropertyId);
      scoped = true;
      console.log(`[sd-refund-cron] Scoped run for bookingId=${scopedBookingId}`);
    } else if (!verifySdRefundCronSecret(req)) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const sb = supabaseAdmin();
    let query = sb
      .from('guest_submissions')
      .select(SELECT_COLUMNS)
      .eq('status', 'READY_FOR_CHECKIN');

    if (scopedBookingId) {
      query = query.eq('id', scopedBookingId);
    } else if (adminPropertyId) {
      query = query.eq('property_id', adminPropertyId);
    }

    const { data: candidates, error } = await query;

    if (error) {
      throw new Error(`DB fetch failed: ${error.message}`);
    }

    if (!candidates || candidates.length === 0) {
      const msg = scopedBookingId
        ? `[sd-refund-cron] No READY_FOR_CHECKIN booking for id=${scopedBookingId}.`
        : '[sd-refund-cron] No READY_FOR_CHECKIN bookings. Nothing to do.';
      console.log(msg);
      return new Response(
        JSON.stringify({
          success: true,
          scoped,
          scanned: 0,
          transitioned: 0,
          skipped: scopedBookingId ? 1 : 0,
          checkoutEmailsSent: 0,
          transitionedSdEmailSent: 0,
          transitionedSdEmailSuppressed: 0,
          results: scopedBookingId
            ? [
                {
                  bookingId: scopedBookingId,
                  action: 'skipped',
                  reason: 'not_found_or_not_ready_for_checkin',
                } satisfies CronResultRow,
              ]
            : [],
        }),
        { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[sd-refund-cron] Scanning ${candidates.length} READY_FOR_CHECKIN booking(s)${scoped ? ' (scoped)' : ''}`
    );

    let transitioned = 0;
    let skipped = 0;
    const results: CronResultRow[] = [];
    const nowMs = nowManila().getTime();

    for (const booking of candidates) {
      const bookingId = booking.id as string;
      const propertyId = (booking.property_id as string | null) ?? null;
      const settings = await resolveAppSettings(propertyId);
      let leadMinutes = settings.sdRefundCronEmailLeadMinutes;
      if (Number.isNaN(leadMinutes) || leadMinutes < 0) {
        leadMinutes = 180;
      }
      const maxCheckoutAgeDays = settings.sdRefundCronMaxCheckoutAgeDays;
      const maxAgeMs =
        maxCheckoutAgeDays > 0
          ? maxCheckoutAgeDays * 24 * 60 * 60 * 1000
          : Number.POSITIVE_INFINITY;

      const checkOutDate = (booking.check_out_date as string) ?? '';
      const checkOutTime = (booking.check_out_time as string) || defaultCheckoutTime();

      const leadWindow = evaluateSdRefundLeadWindow({
        checkOutDate,
        checkOutTime,
        leadMinutes,
        nowMs,
      });

      if (!leadWindow.checkoutDt) {
        console.warn(
          `[sd-refund-cron] Cannot parse checkout datetime for booking ${bookingId}: date="${checkOutDate}" time="${checkOutTime}"`
        );
        results.push({ bookingId, action: 'skipped', reason: 'unparseable_checkout_datetime' });
        skipped++;
        continue;
      }

      const checkoutDt = leadWindow.checkoutDt;

      if (!leadWindow.due) {
        const minutesRemaining = leadWindow.minutesRemaining;
        console.log(
          `[sd-refund-cron] Booking ${bookingId} (${booking.guest_facebook_name}) not yet due ` +
            `(${minutesRemaining} min until lead window opens)`
        );
        results.push({
          bookingId,
          action: 'skipped',
          reason: `not_yet_due_${minutesRemaining}min`,
        });
        skipped++;
        continue;
      }

      const sdAmount = Number(booking.security_deposit ?? 0);
      const sdIsZero = sdAmount === 0;

      // OTA-ingested bookings (calendar sync Phase 2): a blank guest_email means the guest
      // has not completed the forwarded form yet — never send the check-out / SD email to
      // nobody. Once the form is completed guest_email is populated and this clears (same
      // rule as the workflowOrchestrator guard).
      const noGuestContact = !String(booking.guest_email ?? '').trim();

      const checkoutAgeMs = nowMs - checkoutDt.getTime();
      const suppressStaleEmail = checkoutAgeMs > maxAgeMs || sdIsZero || noGuestContact;

      const emailedAtRaw = (booking as Record<string, unknown>).sd_refund_form_emailed_at;
      const hadCheckoutEmailInDb = typeof emailedAtRaw === 'string' && emailedAtRaw.trim() !== '';

      let sentCheckoutEmailThisRun = false;
      if (!suppressStaleEmail && !hadCheckoutEmailInDb) {
        const propertyId =
          typeof booking.property_id === 'string' ? booking.property_id.trim() : '';
        const sdEmailAllowed = propertyId
          ? await propertyAutomationEnabled(propertyId, 'emailSdRefundCheckout')
          : true;
        if (!sdEmailAllowed) {
          console.log(
            `[sd-refund-cron] Check-out email skipped for ${bookingId} (org automation off)`
          );
        } else {
          try {
            const fullRow = await DatabaseService.getBookingById(bookingId);
            if (fullRow) {
              await sendSdRefundFormRequest(fullRow);
              await DatabaseService.setWorkflowFields(bookingId, {
                sd_refund_form_emailed_at: new Date().toISOString(),
              });
              sentCheckoutEmailThisRun = true;
              console.log(
                `[sd-refund-cron] Sent check-out / SD details email for booking ${bookingId} (still READY_FOR_CHECKIN until settlement)`
              );
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[sd-refund-cron] Check-out email failed for ${bookingId}:`, msg);
            results.push({ bookingId, action: 'failed', reason: `checkout_email:${msg}` });
            continue;
          }
        }
      }

      const settlement = canAutoTransitionWithSettlement(booking);
      if (!settlement.ok) {
        console.log(
          `[sd-refund-cron] Booking ${bookingId} in email window but not transitioning yet: ${settlement.reason}`
        );
        if (sentCheckoutEmailThisRun) {
          results.push({ bookingId, action: 'checkout_email_sent', sdRefundFormEmailSent: true });
        } else {
          results.push({ bookingId, action: 'skipped', reason: settlement.reason });
          skipped++;
        }
        continue;
      }

      if (suppressStaleEmail) {
        console.log(
          `[sd-refund-cron] Booking ${bookingId}: check-out older than ${maxCheckoutAgeDays}d — ` +
            'transitioning without automated guest email'
        );
      }

      const hadEmailBeforeTransition = hadCheckoutEmailInDb || sentCheckoutEmailThisRun;
      const sendEmailOnTransition = !suppressStaleEmail && !hadEmailBeforeTransition;

      console.log(
        `[sd-refund-cron] Transitioning booking ${bookingId} (${booking.guest_facebook_name}) ` +
          `checkout ${checkOutDate} ${checkOutTime} → READY_FOR_CHECKOUT` +
          (!sendEmailOnTransition
            ? ' (no SD form email on transition — already sent or stale)'
            : '')
      );

      try {
        await WorkflowOrchestrator.transition(
          bookingId,
          'READY_FOR_CHECKOUT',
          {
            guest_balance_paid_amount: Number(booking.guest_balance_paid_amount),
            guest_balance_payment_receipt_url: String(
              booking.guest_balance_payment_receipt_url ?? ''
            ).trim(),
          },
          {
            saveToDatabase: true,
            generatePdf: false,
            sendGafRequestEmail: false,
            sendParkingBroadcastEmail: false,
            sendPetRequestEmail: false,
            sendBookingAcknowledgementEmail: false,
            sendReadyForCheckinEmail: false,
            sendSdRefundFormEmail: sendEmailOnTransition,
          },
          false, // manual=false — cron-driven transition
          buildActorContext('cron', { cron: 'sd-refund-cron' })
        );

        console.log(`[sd-refund-cron] Transitioned booking ${bookingId} → READY_FOR_CHECKOUT`);
        results.push({
          bookingId,
          action: 'transitioned',
          sdRefundFormEmailSent: sendEmailOnTransition || sentCheckoutEmailThisRun,
        });
        transitioned++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sd-refund-cron] Failed to transition booking ${bookingId}:`, msg);
        results.push({ bookingId, action: 'failed', reason: msg });
        // Don't re-throw — continue processing remaining bookings
      }
    }

    const emailSentCount = results.filter(
      (r) =>
        (r.action === 'transitioned' || r.action === 'checkout_email_sent') &&
        r.sdRefundFormEmailSent === true
    ).length;
    const emailSuppressedCount = results.filter(
      (r) => r.action === 'transitioned' && r.sdRefundFormEmailSent === false
    ).length;
    const checkoutEmailsOnly = results.filter((r) => r.action === 'checkout_email_sent').length;

    const summary = {
      success: true,
      scoped,
      scanned: candidates.length,
      transitioned,
      skipped,
      checkoutEmailsSent: checkoutEmailsOnly,
      transitionedSdEmailSent: emailSentCount,
      transitionedSdEmailSuppressed: emailSuppressedCount,
      results,
    };

    console.log(
      '[sd-refund-cron] Run complete:',
      JSON.stringify({ scanned: candidates.length, transitioned, skipped })
    );

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('[sd-refund-cron] Fatal error:', error);
    await capturePostHogException(error, { logPrefix: 'cron:sd-refund-cron', request: req });
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
