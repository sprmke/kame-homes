/**
 * submit-sd-form — Public POST to submit guest SD refund preferences.
 *
 * Body: { bookingId, refund: { method, ... } }; optional guestFeedback (stored when provided).
 * Validates status === READY_FOR_CHECKOUT, then transitions → PENDING_SD_REFUND via orchestrator.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { WorkflowOrchestrator } from '../_shared/workflowOrchestrator.ts';
import type { TransitionPayload } from '../_shared/workflowOrchestrator.ts';
import { buildActorContext } from '../_shared/activityLog.ts';
import { logGuestActivity } from '../_shared/guestActivity.ts';
import { notifyTelegramAdminSdFormSubmitted } from '../_shared/telegramAdmin.ts';
import { isSdRefundBank, type SdRefundBank } from '../_shared/sdRefundBank.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { maintenanceModeResponse } from '../_shared/platformSettingsCache.ts';
import { captureFaultIfServerError } from '../_shared/httpResponse.ts';
import {
  authorizeGuestBookingAccess,
  guestBookingAccessTokenFromRequest,
} from '../_shared/guestBookingAccessToken.ts';

type RefundBody = {
  method: 'same_phone' | 'other_bank' | 'cash';
  phoneConfirmed?: boolean;
  bank?: SdRefundBank | null;
  accountName?: string | null;
  accountNumber?: string | null;
};

function validateAccountName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return false;
  if (words[0].length < 2 || words[words.length - 1].length < 2) return false;
  const middleWords = words.slice(1, -1);
  return middleWords.every((word) => word.length >= 1);
}

function validateRefund(r: RefundBody): string | null {
  if (!r?.method) return 'refund.method is required';
  // same_phone — guest selects the option that shows their on-file number; no separate checkbox.
  if (r.method === 'other_bank') {
    if (!r.bank) return 'Bank is required';
    if (!isSdRefundBank(r.bank)) return 'Invalid bank';
    const name = (r.accountName ?? '').trim();
    if (!name) return 'Account name is required';
    if (!validateAccountName(name)) {
      return 'Please enter the complete name on the account (first and last name)';
    }
    const acct = (r.accountNumber ?? '').replace(/\s+/g, '');
    if (!acct) return 'Account number is required';
    if (!/^\d+$/.test(acct)) return 'Account number must contain digits only';
    if (acct.length < 5) return 'Account number must be at least 5 digits';
    if (acct.length > 20) return 'Account number is too long';
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const maintenance = await maintenanceModeResponse(req);
    if (maintenance) return maintenance;

    const body = (await req.json().catch(() => null)) as {
      bookingId?: string;
      guestFeedback?: string;
      refund?: RefundBody;
    } | null;

    const bookingId = (body?.bookingId ?? '').trim();
    const guestFeedback = typeof body?.guestFeedback === 'string' ? body.guestFeedback.trim() : '';
    const refund = body?.refund;

    // Anti-spam: bot heuristics → Turnstile → durable rate limit.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const antiSpamBlocked = await antiSpamGate(req, (body ?? {}) as Record<string, unknown>, {
      scope: 'submit-sd-form',
      rateLimit: { limit: 10, windowSec: 60 },
    });
    if (antiSpamBlocked) return antiSpamBlocked;

    if (!bookingId) throw new Error('bookingId is required');
    const errRefund = refund ? validateRefund(refund) : 'refund is required';
    if (errRefund) throw new Error(errRefund);

    const row = await DatabaseService.getBookingById(bookingId);
    const authz = await authorizeGuestBookingAccess({
      bookingIdFromPath: bookingId,
      accessTokenFromQuery: guestBookingAccessTokenFromRequest(req, body),
      bookingCreatedAt: (row?.created_at as string | null | undefined) ?? null,
    });
    if (!authz.ok) {
      return new Response(JSON.stringify({ success: false, error: authz.message }), {
        status: authz.status,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (!row || row.status !== 'READY_FOR_CHECKOUT') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'not_available',
          message: 'This form is no longer available for this booking.',
        }),
        { status: 409, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const payload: TransitionPayload = {
      sd_refund_guest_feedback: guestFeedback || null,
      sd_refund_method: refund!.method,
      sd_refund_phone_confirmed: refund!.method === 'same_phone' ? true : null,
      sd_refund_bank: refund!.method === 'other_bank' ? (refund!.bank ?? null) : null,
      sd_refund_account_name:
        refund!.method === 'other_bank' ? (refund!.accountName ?? '').trim() : null,
      sd_refund_account_number:
        refund!.method === 'other_bank' ? (refund!.accountNumber ?? '').trim() : null,
    };

    await WorkflowOrchestrator.transition(
      bookingId,
      'PENDING_SD_REFUND',
      payload,
      {
        saveToDatabase: true,
        sendGafRequestEmail: false,
        sendParkingBroadcastEmail: false,
        sendPetRequestEmail: false,
        sendBookingAcknowledgementEmail: false,
        sendReadyForCheckinEmail: false,
        sendSdRefundFormEmail: false,
      },
      false,
      buildActorContext('public_form', { guest: {} }, req)
    );

    await logGuestActivity({
      req,
      action: 'guest.sd_form_submitted',
      propertyId: (row.property_id as string | null) ?? null,
      guest: { name: (row.primary_guest_name as string | null) ?? null },
      targetId: bookingId,
      targetLabel: (row.primary_guest_name as string | null) ?? null,
      metadata: { refund_method: refund!.method },
    });

    try {
      const updated = await DatabaseService.getBookingById(bookingId);
      if (updated) {
        const adminTg = await notifyTelegramAdminSdFormSubmitted(updated);
        console.log('[submit-sd-form] Telegram admin SD form:', JSON.stringify(adminTg));
      }
    } catch (tgErr) {
      console.error('[submit-sd-form] Telegram admin SD form notify failed (non-fatal):', tgErr);
    }

    await capturePostHogEvent('sd_form_submitted', {
      logPrefix: 'submit-sd-form',
      request: req,
      properties: {
        property_id: (row.property_id as string | null) ?? undefined,
        booking_id: bookingId,
        refund_method: refund!.method,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you — we have received your security deposit refund information.',
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[submit-sd-form]', error);
    await captureFaultIfServerError(req, error, 'submit-sd-form');
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
