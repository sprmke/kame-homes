/**
 * dashboard-assistant-confirm — executes (or denies) a previously-proposed Tier-2 action, or an
 * entire multi-step plan. Docs: docs/workflow/planned/ai-dashboard-assistant.md §1,
 * docs/workflow/in-progress/agentic-ai-assistants.md Phase 3. Deliberately separate from
 * dashboard-assistant-chat so a write can only ever run via an explicit, isolated call — never as
 * a side effect of the model "changing its mind" mid-generation or a retried chat POST.
 *
 * Single action: { actionId: string, confirm: boolean }
 * Plan (Phase 3): { planId: string, confirm: boolean, selectedStepIds?: string[] }
 *   A plan is a group of pending_actions rows (plan_id set) built by dashboard-assistant-chat
 *   when a turn collects 2+ write proposals. `selectedStepIds` is the host's final tick state —
 *   omitted selected rows from the plan's own `selected: true` default also run; omit the field
 *   entirely to run every step as proposed. Steps run in order; a step depending on one that
 *   failed or was deselected is skipped, independent steps still run.
 */

import { getAssistantToolActivityLabel } from '../_shared/assistantToolLabels.ts';
import {
  DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE,
  getDashboardAssistantOrgSettings,
  incrementDashboardAssistantUsage,
  remainingDashboardAssistantWrites,
} from '../_shared/dashboardAssistantSettings.ts';
import { stripAssistantScopeFromPayload } from '../_shared/dashboardAssistantAttachedContext.ts';
import {
  pickMessageWithAction,
  pickMessageWithPlan,
  updateActionBlockStatus,
  updateActionPlanBlock,
} from '../_shared/dashboardAssistantConfirmBlocks.ts';
import { appendFollowThroughChips } from '../_shared/dashboardAssistantHostDisplay.ts';
import {
  derivePlanStatus,
  resolveStepPlaceholders,
  stepsToSkipForFailure,
  type PlanStepStatus,
} from '../_shared/dashboardAssistantPlans.ts';
import type { ChatBlock } from '../_shared/dashboardAssistantSafetyGuard.ts';
import {
  executeConfirmedAction,
  executeTool,
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
import { createServiceClient, type AuthenticatedUser } from '../_shared/orgAuth.ts';
import {
  PlanFeatureRequiredError,
  requireOrgFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

async function loadActionMessage(
  sb: ReturnType<typeof createServiceClient>,
  conversationId: string,
  pendingMessageId: string,
  actionId: string
) {
  const { data: recent } = await sb
    .from('ai_dashboard_assistant_messages')
    .select('id, blocks')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(12);
  const hit = pickMessageWithAction(recent ?? [], actionId);
  if (hit) return hit;
  const { data: fallback } = await sb
    .from('ai_dashboard_assistant_messages')
    .select('id, blocks')
    .eq('id', pendingMessageId)
    .maybeSingle();
  return fallback;
}

async function loadPlanMessage(
  sb: ReturnType<typeof createServiceClient>,
  conversationId: string,
  planMessageId: string,
  planId: string
) {
  const { data: recent } = await sb
    .from('ai_dashboard_assistant_messages')
    .select('id, blocks')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(12);
  const hit = pickMessageWithPlan(recent ?? [], planId);
  if (hit) return hit;
  const { data: fallback } = await sb
    .from('ai_dashboard_assistant_messages')
    .select('id, blocks')
    .eq('id', planMessageId)
    .maybeSingle();
  return fallback;
}

type PlanStepRow = {
  id: string;
  user_id: string;
  tool_name: string;
  input_payload: Record<string, unknown>;
  risk_tier: 'tier1_auto' | 'tier2_confirmed';
  step_index: number;
  depends_on: number[];
  selected: boolean;
};

/** Phase 3 plan-card approval — see the file header for the body shape. */
async function handlePlanConfirm(
  req: Request,
  user: AuthenticatedUser,
  planId: string,
  confirm: boolean,
  rawSelectedStepIds: unknown
): Promise<Response> {
  const sb = createServiceClient();
  const { data: plan, error: planError } = await sb
    .from('ai_dashboard_assistant_action_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (planError || !plan) return jsonError(req, 'Plan not found', 404);
  if (plan.user_id !== user.id) {
    return jsonError(req, 'Only the user who proposed this plan may confirm it', 403);
  }
  if (plan.status !== 'proposed') {
    return jsonSuccess(req, { status: plan.status, alreadyResolved: true });
  }
  if (new Date(plan.expires_at as string).getTime() < Date.now()) {
    await sb
      .from('ai_dashboard_assistant_action_plans')
      .update({ status: 'expired' })
      .eq('id', planId);
    return jsonError(req, 'This plan has expired - ask the assistant again', 410);
  }

  const { data: steps, error: stepsError } = await sb
    .from('ai_dashboard_assistant_pending_actions')
    .select('id, user_id, tool_name, input_payload, risk_tier, step_index, depends_on, selected')
    .eq('plan_id', planId)
    .order('step_index', { ascending: true })
    // Plan steps are capped by assistantMaxPlanSteps (single digits); the limit only keeps
    // a corrupt row set from being loaded whole.
    .limit(50);
  if (stepsError || !steps || steps.length === 0) {
    return jsonError(req, 'Plan has no steps', 404);
  }
  const planSteps = steps as unknown as PlanStepRow[];

  const { data: conversation } = await sb
    .from('ai_dashboard_assistant_conversations')
    .select('organization_id, property_id')
    .eq('id', plan.conversation_id)
    .maybeSingle();
  if (!conversation) return jsonError(req, 'Conversation not found', 404);

  if (!confirm) {
    await sb
      .from('ai_dashboard_assistant_action_plans')
      .update({ status: 'cancelled' })
      .eq('id', planId);
    await sb
      .from('ai_dashboard_assistant_pending_actions')
      .update({ status: 'denied' })
      .eq('plan_id', planId);
    const msg = await loadPlanMessage(
      sb,
      plan.conversation_id as string,
      plan.message_id as string,
      planId
    );
    if (msg) {
      const nextBlocks = updateActionPlanBlock(msg.blocks, planId, {
        status: 'cancelled',
        steps: planSteps.map((s) => ({ stepId: s.id, status: 'denied' })),
      });
      await sb
        .from('ai_dashboard_assistant_messages')
        .update({ blocks: nextBlocks })
        .eq('id', msg.id);
    }
    return jsonSuccess(req, { status: 'cancelled' });
  }

  // Downgrade re-check, same gate as the single-action path.
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

  const selectedStepIds =
    Array.isArray(rawSelectedStepIds) && rawSelectedStepIds.every((v) => typeof v === 'string')
      ? new Set(rawSelectedStepIds as string[])
      : new Set(planSteps.filter((s) => s.selected).map((s) => s.id));
  const selectedCount = planSteps.filter((s) => selectedStepIds.has(s.id)).length;

  const orgSettings = await getDashboardAssistantOrgSettings(
    conversation.organization_id as string
  );
  if (
    selectedCount > 0 &&
    (await remainingDashboardAssistantWrites(conversation.organization_id as string, orgSettings)) <
      selectedCount
  ) {
    return jsonError(req, DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE, 429);
  }

  // Atomic claim at the plan level — a double click or retried POST can never run the plan twice.
  const { data: claimed, error: claimError } = await sb
    .from('ai_dashboard_assistant_action_plans')
    .update({ status: 'running' })
    .eq('id', planId)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return jsonSuccess(req, { status: 'proposed', alreadyResolved: true });

  const depsList = planSteps.map((s) => ({
    stepIndex: s.step_index,
    dependsOn: s.depends_on ?? [],
  }));
  const unselectedIndexes = new Set(
    planSteps.filter((s) => !selectedStepIds.has(s.id)).map((s) => s.step_index)
  );
  const failedIndexes = new Set<number>();
  const priorResults = new Map<number, unknown>();

  type StepOutcome = {
    id: string;
    toolName: string;
    stepIndex: number;
    status: PlanStepStatus;
    ok: boolean;
    error?: string;
  };
  const outcomes: StepOutcome[] = [];

  for (const step of planSteps) {
    const effectiveFailed = new Set([...failedIndexes, ...unselectedIndexes]);
    const skipSet = stepsToSkipForFailure(depsList, effectiveFailed);
    const isUnselected = unselectedIndexes.has(step.step_index);
    const isSkippedByDependency = !isUnselected && skipSet.has(step.step_index);

    if (isUnselected || isSkippedByDependency) {
      const reason = isUnselected ? null : 'Skipped - a step it depends on did not run.';
      await sb
        .from('ai_dashboard_assistant_pending_actions')
        .update({ status: 'denied', result: reason ? { ok: false, error: reason } : null })
        .eq('id', step.id);
      outcomes.push({
        id: step.id,
        toolName: step.tool_name,
        stepIndex: step.step_index,
        status: 'denied',
        ok: false,
        error: reason ?? undefined,
      });
      if (isSkippedByDependency) failedIndexes.add(step.step_index);
      continue;
    }

    const { payload: rawPayload, scope } = stripAssistantScopeFromPayload(step.input_payload);
    const resolvedPayload = resolveStepPlaceholders(rawPayload, priorResults);
    const toolCtx: ToolExecutionContext = {
      req,
      organizationId: conversation.organization_id as string,
      userId: user.id,
      userEmail: user.email ?? '',
      pageContext: scope?.pageContext ?? {
        propertyId: (conversation.property_id as string | null) ?? null,
        bookingId: (resolvedPayload.bookingId as string | undefined) ?? null,
      },
      attachedContext: scope?.attachedContext ?? [],
      isBulk: false,
      conversationId: plan.conversation_id as string,
    };

    const result =
      step.risk_tier === 'tier2_confirmed'
        ? await executeConfirmedAction(step.tool_name, resolvedPayload, toolCtx)
        : await executeTool(step.tool_name, resolvedPayload, {
            ...toolCtx,
            deferWritesUntilCommit: false,
          });

    await logAssistantWriteActivity(toolCtx, step.tool_name, result, step.risk_tier);
    await sb.from('ai_dashboard_assistant_action_audit').insert({
      organization_id: conversation.organization_id,
      property_id: result.auditPropertyId ?? conversation.property_id,
      booking_id: result.auditBookingId ?? null,
      user_id: user.id,
      conversation_id: plan.conversation_id,
      message_id: plan.message_id,
      tool_name: step.tool_name,
      risk_tier: step.risk_tier,
      input_payload: resolvedPayload,
      result_status: result.ok ? 'success' : 'failed',
      result_summary: result.error ?? null,
    });

    const finalStatus: PlanStepStatus = result.ok ? 'executed' : 'failed';
    await sb
      .from('ai_dashboard_assistant_pending_actions')
      .update({
        status: finalStatus,
        result: { ok: result.ok, data: result.data ?? null, error: result.error ?? null },
      })
      .eq('id', step.id);

    priorResults.set(step.step_index, result.data ?? null);
    if (!result.ok) failedIndexes.add(step.step_index);
    else
      await incrementDashboardAssistantUsage(conversation.organization_id as string, {
        writeAction: true,
      });

    outcomes.push({
      id: step.id,
      toolName: step.tool_name,
      stepIndex: step.step_index,
      status: finalStatus,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    });
  }

  const finalPlanStatus = derivePlanStatus(
    planSteps.map((s) => ({
      selected: !unselectedIndexes.has(s.step_index),
      status: outcomes.find((o) => o.id === s.id)?.status ?? 'denied',
    }))
  );
  await sb
    .from('ai_dashboard_assistant_action_plans')
    .update({ status: finalPlanStatus })
    .eq('id', planId);

  // Deterministic continuation summary — no second model call, so a step outcome is never
  // paraphrased or guessed at. A full agentic continuation turn (follow-up reads informed by
  // step results) is explicitly out of scope for this pass; see the plan doc's Phase 3 entry.
  const executedCount = outcomes.filter((o) => o.status === 'executed').length;
  const failedCount = outcomes.filter((o) => o.status === 'failed').length;
  const skippedCount = outcomes.length - executedCount - failedCount;
  const lines = outcomes.map((o) => {
    const label = getAssistantToolActivityLabel(
      o.toolName,
      o.status === 'executed' ? 'done' : 'failed'
    );
    const tag = o.status === 'executed' ? 'Done' : o.status === 'failed' ? 'Failed' : 'Skipped';
    return `- ${tag}: ${label}`;
  });
  const headline =
    finalPlanStatus === 'cancelled'
      ? 'Plan cancelled - nothing was applied.'
      : `Completed ${executedCount} of ${outcomes.length} step${outcomes.length === 1 ? '' : 's'}` +
        (failedCount > 0 ? `, ${failedCount} failed` : '') +
        (skippedCount > 0 ? `, ${skippedCount} skipped` : '') +
        '.';
  const continuationText = [headline, ...lines].join('\n');

  const msg = await loadPlanMessage(
    sb,
    plan.conversation_id as string,
    plan.message_id as string,
    planId
  );
  let persistedBlocks: unknown = null;
  if (msg) {
    let nextBlocks = updateActionPlanBlock(msg.blocks, planId, {
      status: finalPlanStatus,
      steps: outcomes.map((o) => ({
        stepId: o.id,
        status: o.status,
        errorMessage: o.error,
      })),
    });
    if (Array.isArray(nextBlocks)) {
      nextBlocks = [...nextBlocks, { type: 'text', text: continuationText }];
      if (executedCount > 0) {
        nextBlocks = appendFollowThroughChips(
          nextBlocks as ChatBlock[],
          outcomes.filter((o) => o.status === 'executed').map((o) => o.toolName)
        );
      }
    }
    persistedBlocks = nextBlocks;
    await sb
      .from('ai_dashboard_assistant_messages')
      .update({ blocks: nextBlocks })
      .eq('id', msg.id);
  }

  return jsonSuccess(req, {
    status: finalPlanStatus,
    steps: outcomes,
    text: continuationText,
    blocks: Array.isArray(persistedBlocks) ? persistedBlocks : undefined,
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
    const planId = String(body.planId ?? '').trim();
    const confirm = body.confirm === true;
    if (planId) {
      return handlePlanConfirm(req, user, planId, confirm, body.selectedStepIds);
    }

    const actionId = String(body.actionId ?? '').trim();
    if (!actionId) return jsonError(req, 'actionId or planId is required', 400);

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
      return jsonError(req, 'This action has expired - ask the assistant again', 410);
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
      const deniedMsg = await loadActionMessage(
        sb,
        pending.conversation_id as string,
        pending.message_id as string,
        actionId
      );
      if (deniedMsg) {
        await sb
          .from('ai_dashboard_assistant_messages')
          .update({ blocks: updateActionBlockStatus(deniedMsg.blocks, actionId, 'denied') })
          .eq('id', deniedMsg.id);
      }
      await capturePostHogEvent('ai_assistant_action_rejected', {
        logPrefix: 'dashboard-assistant-confirm',
        request: req,
        distinctId: user.id,
        groups: { organization: conversation.organization_id as string },
        properties: { tool: pending.tool_name as string },
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

    const orgSettings = await getDashboardAssistantOrgSettings(
      conversation.organization_id as string
    );
    if (
      (await remainingDashboardAssistantWrites(
        conversation.organization_id as string,
        orgSettings
      )) < 1
    ) {
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
    await logAssistantWriteActivity(
      toolCtx,
      pending.tool_name as string,
      result,
      'tier2_confirmed'
    );
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

    let persistedBlocks: unknown = null;
    const msg = await loadActionMessage(
      sb,
      pending.conversation_id as string,
      pending.message_id as string,
      actionId
    );
    if (msg) {
      let nextBlocks = updateActionBlockStatus(
        msg.blocks,
        actionId,
        newStatus,
        result.error,
        result.ok ? result.resultNote : null
      );
      if (result.ok && Array.isArray(nextBlocks)) {
        nextBlocks = appendFollowThroughChips(nextBlocks as ChatBlock[], [
          String(pending.tool_name),
        ]);
      }
      persistedBlocks = nextBlocks;
      await sb
        .from('ai_dashboard_assistant_messages')
        .update({ blocks: nextBlocks })
        .eq('id', msg.id);
    }

    if (result.ok) {
      await incrementDashboardAssistantUsage(conversation.organization_id as string, {
        writeAction: true,
      });
    }

    await capturePostHogEvent('ai_assistant_action_confirmed', {
      logPrefix: 'dashboard-assistant-confirm',
      request: req,
      distinctId: user.id,
      groups: { organization: conversation.organization_id as string },
      properties: { tool: pending.tool_name as string },
    });

    return jsonSuccess(req, {
      status: newStatus,
      ok: result.ok,
      error: result.error,
      data: result.data,
      resultNote: result.ok ? (result.resultNote ?? null) : null,
      blocks: Array.isArray(persistedBlocks) ? persistedBlocks : undefined,
    });
  } catch (err) {
    return handleEdgeError(req, err, 'dashboard-assistant-confirm');
  }
});
