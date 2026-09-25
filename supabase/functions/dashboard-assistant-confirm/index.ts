/**
 * dashboard-assistant-confirm — executes (or denies) a previously-proposed Tier-2 action.
 * Docs: docs/workflow/planned/ai-dashboard-assistant.md §1. Deliberately separate from
 * dashboard-assistant-chat so a Tier-2 action can only ever run via an explicit, isolated call —
 * never as a side effect of the model "changing its mind" mid-generation or a retried chat POST.
 *
 * Body: { actionId: string, confirm: boolean }
 */

import {
  DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE,
  getDashboardAssistantOrgSettings,
  incrementDashboardAssistantUsage,
  remainingDashboardAssistantWrites,
} from '../_shared/dashboardAssistantSettings.ts';
import { stripAssistantScopeFromPayload } from '../_shared/dashboardAssistantAttachedContext.ts';
import { humanizeTransitionError } from '../_shared/dashboardAssistantActionDisplay.ts';
import {
  executeConfirmedAction,
  logAssistantWriteActivity,
  type ToolExecutionContext,
} from '../_shared/dashboardAssistantTools.ts';
import {
  handleEdgeError,
  jsonError,
  jsonSuccess,
  jsonUpgradeHook,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  PlanFeatureRequiredError,
  requireOrgFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function updateActionBlockStatus(
  blocks: unknown,
  actionId: string,
  status: string,
  errorMessage?: string | null
) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (
      block &&
      typeof block === 'object' &&
      block.type === 'action_confirmation' &&
      block.actionId === actionId
    ) {
      return {
        ...block,
        status,
        ...(errorMessage ? { errorMessage: humanizeTransitionError(errorMessage) } : {}),
      };
    }
    if (
      block &&
      typeof block === 'object' &&
      block.type === 'stepper' &&
      Array.isArray(block.steps)
    ) {
      return {
        ...block,
        steps: block.steps.map((step: { actionBlock?: { actionId?: string } }) =>
          step.actionBlock?.actionId === actionId
            ? {
                ...step,
                actionBlock: {
                  ...step.actionBlock,
                  status,
                  ...(errorMessage ? { errorMessage: humanizeTransitionError(errorMessage) } : {}),
                },
              }
            : step
        ),
      };
    }
    return block;
  });
}

serveAuthenticated('dashboard-assistant-confirm', async (req, user) => {
  try {
    requireHttpMethod(req, 'POST');

    const limited = await rateLimitGate(req, {
      scope: 'dashboard-assistant-confirm',
      identity: identityFromRequest(req, user),
      limit: 30,
      windowSec: 600,
    });
    if (limited) return limited;

    const body = await readJsonBody(req);
    const actionId = String(body.actionId ?? '').trim();
    const confirm = body.confirm === true;
    if (!actionId) return jsonError(req, 'actionId is required', 400);

    const sb = createServiceClient();
    const { data: pending, error: pendingError } = await sb
      .from('ai_dashboard_assistant_pending_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle();
    if (pendingError || !pending) {
      return jsonError(req, 'Pending action not found', 404);
    }
    if (pending.user_id !== user.id) {
      return jsonError(req, 'Only the user who proposed this action may confirm it', 403);
    }
    if (pending.status !== 'pending') {
      return jsonSuccess(req, { status: pending.status, alreadyResolved: true });
    }
    if (new Date(pending.expires_at as string).getTime() < Date.now()) {
      await sb
        .from('ai_dashboard_assistant_pending_actions')
        .update({ status: 'expired' })
        .eq('id', actionId);
      return jsonError(req, 'This action has expired — ask the assistant again', 410);
    }

    const { data: conversation } = await sb
      .from('ai_dashboard_assistant_conversations')
      .select('organization_id, property_id')
      .eq('id', pending.conversation_id)
      .maybeSingle();
    if (!conversation) return jsonError(req, 'Conversation not found', 404);

    // A downgrade can happen between the assistant proposing this action and the user confirming
    // it — re-check entitlement here, not just at proposal time in dashboard-assistant-chat, or a
    // property/org that dropped below the required tier could still execute a queued Tier-2
    // action. Mirrors dashboard-assistant-chat's own gate exactly: property-scoped when the
    // conversation has a property_id, property-independent org gate otherwise (org/parking-scoped
    // conversation) — same requireOrgFeature closing the parking-property-parity.md interim-ungate
    // blocker.
    if (confirm) {
      try {
        if (conversation.property_id) {
          await requirePropertyFeature(conversation.property_id as string, 'aiDashboardAssistant');
        } else {
          await requireOrgFeature(conversation.organization_id as string, 'aiDashboardAssistant');
        }
      } catch (err) {
        if (err instanceof PlanFeatureRequiredError) {
          return jsonUpgradeHook(req, err.message, { feature: err.feature });
        }
        throw err;
      }
    }

    if (!confirm) {
      await sb
        .from('ai_dashboard_assistant_pending_actions')
        .update({ status: 'denied' })
        .eq('id', actionId);
      await sb
        .from('ai_dashboard_assistant_messages')
        .select('id, blocks')
        .eq('id', pending.message_id)
        .maybeSingle()
        .then(async ({ data: msg }) => {
          if (msg) {
            await sb
              .from('ai_dashboard_assistant_messages')
              .update({ blocks: updateActionBlockStatus(msg.blocks, actionId, 'denied') })
              .eq('id', msg.id);
          }
        });
      return jsonSuccess(req, { status: 'denied' });
    }

    const rawPayload = (pending.input_payload ?? {}) as Record<string, unknown>;
    const { payload: inputPayload, scope } = stripAssistantScopeFromPayload(rawPayload);
    const toolCtx: ToolExecutionContext = {
      req,
      organizationId: conversation.organization_id as string,
      userId: user.id,
      userEmail: user.email ?? '',
      pageContext: scope?.pageContext ?? {
        propertyId: (conversation.property_id as string | null) ?? null,
        bookingId: (inputPayload.bookingId as string | undefined) ?? null,
      },
      attachedContext: scope?.attachedContext ?? [],
      isBulk: false,
      conversationId: pending.conversation_id as string,
    };

    const orgSettings = await getDashboardAssistantOrgSettings(conversation.organization_id as string);
    if ((await remainingDashboardAssistantWrites(conversation.organization_id as string, orgSettings)) < 1) {
      return jsonError(req, DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE, 429);
    }

    // Atomic claim: only one request can move this row out of `pending`, so a double-click or a
    // retried POST can never execute the same action twice. A row left in `confirmed` (crash
    // mid-execution) is intentionally never re-run.
    const { data: claimed, error: claimError } = await sb
      .from('ai_dashboard_assistant_pending_actions')
      .update({ status: 'confirmed' })
      .eq('id', actionId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      return jsonSuccess(req, { status: 'pending', alreadyResolved: true });
    }

    const result = await executeConfirmedAction(pending.tool_name as string, inputPayload, toolCtx);
    await logAssistantWriteActivity(toolCtx, pending.tool_name as string, result, 'tier2_confirmed');
    // The chat block keeps the existing UI contract (`denied` + errorMessage renders the failure);
    // the pending-action row records the truthful `failed` for reporting.
    const newStatus = result.ok ? 'executed' : 'denied';

    await sb
      .from('ai_dashboard_assistant_pending_actions')
      .update({ status: result.ok ? 'executed' : 'failed' })
      .eq('id', actionId);

    await sb.from('ai_dashboard_assistant_action_audit').insert({
      organization_id: conversation.organization_id,
      property_id: result.auditPropertyId ?? conversation.property_id,
      booking_id: result.auditBookingId ?? null,
      user_id: user.id,
      conversation_id: pending.conversation_id,
      message_id: pending.message_id,
      tool_name: pending.tool_name,
      risk_tier: 'tier2_confirmed',
      input_payload: inputPayload,
      result_status: result.ok ? 'success' : 'failed',
      result_summary: result.error ?? null,
    });

    const { data: msg } = await sb
      .from('ai_dashboard_assistant_messages')
      .select('id, blocks')
      .eq('id', pending.message_id)
      .maybeSingle();
    if (msg) {
      await sb
        .from('ai_dashboard_assistant_messages')
        .update({ blocks: updateActionBlockStatus(msg.blocks, actionId, newStatus, result.error) })
        .eq('id', msg.id);
    }

    if (result.ok) {
      await incrementDashboardAssistantUsage(conversation.organization_id as string, {
        writeAction: true,
      });
    }

    return jsonSuccess(req, {
      status: newStatus,
      ok: result.ok,
      error: result.error,
      data: result.data,
    });
  } catch (err) {
    return handleEdgeError(req, err, 'dashboard-assistant-confirm');
  }
});
