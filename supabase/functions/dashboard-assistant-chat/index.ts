/**
 * dashboard-assistant-chat — main AI dashboard assistant turn endpoint.
 * Docs: docs/workflow/planned/ai-dashboard-assistant.md §1 (turn flow), §2 (tools), §5 (guardrails).
 *
 * Body: { conversationId?, orgSlug, pageContext: { propertyId?, parkingId?, bookingId? }, attachedContext?: AttachedContextItem[], message, displayMessage?, attachments?: [{ name, mimeType, dataBase64 }], stream?: boolean, regenerate?: boolean, editMessageId?: string }
 *
 * `displayMessage` (optional) is the host-facing text stored on the user row / shown in History.
 * `message` is what the model receives for this turn (may include richer chip guidance).
 * Never persist tool-name / system-instruction prompts as the visible user bubble.
 *
 * `regenerate: true` reuses the last user message in `conversationId`, deletes later assistant
 * rows, and does not insert a duplicate user message. Attachments are not supported on regenerate.
 *
 * `editMessageId` (edit & resend) deletes that user message and every later row in the
 * conversation, expires their pending actions, then runs `message` as a normal new turn.
 * Tier-1 writes that already ran are not undone.
 *
 * The response (JSON `data` or the terminal SSE `blocks` event) carries `messageId` (assistant
 * row) and `userMessageId` so the client can attach feedback, copy and edit to real rows.
 *
 * Tier-2 actions are never executed here — a proposal short-circuits the tool loop and returns
 * an `action_confirmation` block with status "proposed"; dashboard-assistant-confirm executes it.
 */

import { z } from 'zod';

import {
  commitDeferredTier1Writes,
  type AssistantAppliedEffect,
  type DeferredToolCall,
} from '../_shared/dashboardAssistantDeferredWrites.ts';
import {
  prependActivityTimeline,
  prependTaskPlan,
  TurnActivityRecorder,
  TurnTaskPlanRecorder,
} from '../_shared/dashboardAssistantActivity.ts';
import {
  capEntityRefs,
  dedupeEntityRefs,
  extractEntityRefs,
  type EntityRef,
} from '../_shared/dashboardAssistantEntityRefs.ts';
import {
  classifyToolFailure,
  hostFacingToolFailureReason,
  modelFacingToolFailureHint,
} from '../_shared/assistantToolFailureReason.ts';
import {
  AssistantTurnAbortedError,
  assistantStreamResponse,
  createAssistantStreamEmitter,
  isAssistantTurnAbortedError,
  streamAssistantTextPreview,
  wantsAssistantStream,
  type AssistantStreamEmitter,
} from '../_shared/dashboardAssistantStreamEvents.ts';
import {
  attachedContextPromptLines,
  attachedTemplateContext,
  parseAttachedContextInput,
  verifyAttachedContextAccess,
  withAssistantScope,
} from '../_shared/dashboardAssistantAttachedContext.ts';
import {
  buildHostSafeGroundingFacts,
  hostSafeGroundingFactsToPrompt,
} from '../_shared/dashboardAssistantContext.ts';
import {
  checkDashboardAssistantQuota,
  getDashboardAssistantGlobalSettings,
  getDashboardAssistantOrgSettings,
  DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE,
  incrementDashboardAssistantUsage,
  remainingDashboardAssistantWrites,
  isDashboardAssistantAccessible,
  resolveDashboardAssistantKillSwitch,
} from '../_shared/dashboardAssistantSettings.ts';
import {
  isExternalSendTool,
  TIER1_ONLY_TOOL_NAMES,
  TIER2_ONLY_TOOL_NAMES,
  UNTRUSTED_CONTENT_TOOL_NAMES,
} from '../_shared/dashboardAssistantRiskClassifier.ts';
import { aiDisabledScope, isAiQuotaError } from '../_shared/aiUsageService.ts';
import {
  buildActionConfirmationDetails,
  buildActionConfirmationDiff,
  buildTier1ActionSummary,
  humanizeActionConfirmationSummary,
  isBookingJourneyRecord,
} from '../_shared/dashboardAssistantActionDisplay.ts';
import {
  knowledgeSourceLinks,
  buildBookingJourneyData,
} from '../_shared/dashboardAssistantBlocks.ts';
import {
  conversationContextPromptSection,
  loadConversationContext,
} from '../_shared/dashboardAssistantConversationContext.ts';
import {
  appendLeadChips,
  summarizeGatheredToolResults,
} from '../_shared/dashboardAssistantHostDisplay.ts';
import {
  canSkipStructuredSynth,
  CONTINUE_REST_ACTION,
  finalizeResponseBlocks,
  shapeCandidateBlocks,
} from '../_shared/dashboardAssistantResponseShape.ts';
import {
  guardDashboardAssistantResponse,
  quickSafetyScan,
  type ActionPlanStep,
  type ChatBlock,
} from '../_shared/dashboardAssistantSafetyGuard.ts';
import { capPlanSteps, findStepDependencies } from '../_shared/dashboardAssistantPlans.ts';
import {
  parseIncomingAttachments,
  persistAssistantAttachments,
} from '../_shared/dashboardAssistantAttachments.ts';
import {
  openPageBlockFromUserIntent,
  openPageBlocksFromResults,
} from '../_shared/dashboardAssistantNavigationTools.ts';
import {
  routeAssistantModules,
  selectToolDeclarations,
} from '../_shared/dashboardAssistantToolRouter.ts';
import { TurnTimer } from '../_shared/dashboardAssistantTurnTiming.ts';
import { describeOpenPlanSteps } from '../_shared/ai/agent/completionCheck.ts';
import {
  countTurnIntents,
  resolveDashboardAssistantFeature,
} from '../_shared/ai/agent/modelPolicy.ts';
import { createTurnDeadline, turnDeadlineMsFromEnv } from '../_shared/ai/agent/turnBudget.ts';
import { TurnLedger } from '../_shared/ai/agent/turnLedger.ts';
import { buildHeldBackBlocks } from '../_shared/ai/agent/heldBackSteps.ts';
import { callSignature } from '../_shared/ai/agent/agentLoop.ts';
import {
  REQUEST_TOOLS_DECLARATION,
  REQUEST_TOOLS_NAME,
  widenToolsForModules,
} from '../_shared/ai/agent/toolRegistry.ts';
import { PLAN_TASK_DECLARATION, PLAN_TASK_NAME } from '../_shared/ai/agent/taskPlanTool.ts';
import {
  parseMarkMaintenanceDoneQuery,
  pickOpenMaintenanceItem,
} from '../_shared/dashboardAssistantMarkDone.ts';
import {
  executeTool,
  logAssistantWriteActivity,
  TOOL_DECLARATIONS,
  type ToolExecutionContext,
  type ToolResult,
} from '../_shared/dashboardAssistantTools.ts';
import {
  generateStructuredViaTool,
  generateWithTools,
  generateWithToolsStream,
  type GeminiContent,
} from '../_shared/ai/llmTools.ts';
import {
  EdgeError,
  handleEdgeError,
  jsonError,
  jsonResponse,
  jsonSuccess,
  jsonUpgradeHook,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import {
  PlanFeatureRequiredError,
  requireOrgFeature,
  requireOrgPropertyFeature,
  requirePropertyFeature,
} from '../_shared/planEntitlements.ts';
import { createServiceClient, verifyOrgAccess, verifyPropertyAccess } from '../_shared/orgAuth.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { allTeamPermissions } from '../_shared/propertyTeamPermissions.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  boundToolResult,
  estimateHistoryTokens,
  fitHistoryToTokenBudget,
} from '../_shared/ai/contextBudget.ts';
import { redactSensitiveFields } from '../_shared/ai/redact.ts';
import { inlineUntrusted } from '../_shared/ai/untrusted.ts';
import {
  BLOCKS_RESPONSE_SCHEMA,
  DASHBOARD_ASSISTANT_BLOCKS_PROMPT,
  DASHBOARD_ASSISTANT_PROMPT,
  RESPOND_WITH_BLOCKS_DECLARATION,
  RESPOND_WITH_BLOCKS_NAME,
  SYSTEM_PROMPT_PREFIX,
} from '../_shared/ai/prompts/dashboardAssistant.ts';
import {
  getCachedGroundingFacts,
  groundingCacheKey,
  invalidateGroundingCache,
} from '../_shared/dashboardAssistantGroundingCache.ts';
import { shouldRunLlmGuard } from '../_shared/dashboardAssistantGuardPolicy.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';

// Adaptive loop: up to `orgSettings.maxToolRounds` rounds (Phase 6, aiLimitResolver's
// assistantMaxToolRounds — defaults to 8, the pre-Phase-6 hard-coded figure), but a turn ends as
// soon as the model stops calling tools or the turn history passes TURN_HISTORY_TOKEN_BUDGET, so
// simple answers still take one round. See `effectiveMaxRounds` below, computed per turn.
/** Host message cap — bounds prompt size / cost before any context is loaded. */
const MAX_MESSAGE_CHARS = 4_000;
/** Per-round tool budget — bounds latency/cost when the model fans out many calls at once. */
const MAX_TOOL_CALLS_PER_ROUND = 8;
/** Prior-conversation share of the context window (oldest turns drop first). */
const PRIOR_HISTORY_TOKEN_BUDGET = 8_000;
/** Whole-turn input budget; once tool results exceed it the turn stops calling tools and answers. */
const TURN_HISTORY_TOKEN_BUDGET = 60_000;
/** Hosts cannot turn a platform-level block back on, so the message names who did. */
const AI_OFF_BY_PLATFORM_MESSAGE = 'The AI assistant is turned off by the platform admin.';
const WRITE_TOOL_NAMES = new Set([
  ...TIER1_ONLY_TOOL_NAMES,
  ...TIER2_ONLY_TOOL_NAMES,
  'propose_transition_booking',
]);

/**
 * The client-sent pageContext.propertyId drives the plan gate, the per-property kill switch and
 * conversation.property_id, so it must belong to the org this chat is scoped to — never trust it
 * just because the caller is an owner/admin somewhere.
 */
async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<void> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.organization_id !== organizationId) {
    throw new EdgeError(403, 'Property is not in this organization', 'property_scope_mismatch');
  }
}

async function propertySlugFor(propertyId: string | null): Promise<string | null> {
  if (!propertyId) return null;
  const { data } = await createServiceClient()
    .from('properties')
    .select('slug')
    .eq('id', propertyId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? null;
}

async function resolveEffectivePermissions(
  req: Request,
  accessKind: string,
  organizationId: string,
  propertyId: string | null | undefined
): Promise<{ permissions: string[]; propertyId: string | null }> {
  if (propertyId) await assertPropertyInOrg(propertyId, organizationId);
  if (accessKind === 'owner' || accessKind === 'platform_admin' || accessKind === 'org_admin') {
    return {
      permissions: allTeamPermissions(),
      propertyId: propertyId ?? null,
    };
  }
  if (propertyId) {
    // Members need the dedicated assistant leaf; owners / org admins are implicit above.
    const access = await verifyPropertyAccess(req, propertyId, 'assistant:view');
    return { permissions: access.permissions, propertyId: access.property.id };
  }
  return { permissions: [], propertyId: null };
}

serveAuthenticated('dashboard-assistant-chat', async (req, user) => {
  try {
    requireHttpMethod(req, 'POST');
    // Started before any I/O so total_ms is what the host actually waited for.
    const timer = new TurnTimer();
    const preloadStartedAt = Date.now();
    // Below the edge function's own wall-clock kill limit, so a new round only starts when
    // there's still time to synthesize, guard and persist the reply.
    const turnDeadline = createTurnDeadline(
      turnDeadlineMsFromEnv(Deno.env.get('ASSISTANT_TURN_DEADLINE_MS'))
    );

    const limited = await rateLimitGate(req, {
      scope: 'dashboard-assistant-chat',
      identity: identityFromRequest(req, user),
      limit: 30,
      windowSec: 600,
    });
    if (limited) return limited;

    const body = await readJsonBody(req);
    const orgSlug = String(body.orgSlug ?? '').trim();
    const message = String(body.message ?? '').trim();
    const displayMessage = String(body.displayMessage ?? body.displayText ?? '').trim();
    if (message.length > MAX_MESSAGE_CHARS || displayMessage.length > MAX_MESSAGE_CHARS) {
      return jsonError(req, `Message is too long (max ${MAX_MESSAGE_CHARS} characters)`, 400);
    }
    const conversationIdInput = body.conversationId ? String(body.conversationId).trim() : null;
    const regenerate = body.regenerate === true;
    const editMessageId = body.editMessageId ? String(body.editMessageId).trim() : null;
    const incomingAttachments = parseIncomingAttachments(body.attachments);
    const pageContext = {
      propertyId: body.pageContext?.propertyId ? String(body.pageContext.propertyId) : null,
      parkingId: body.pageContext?.parkingId ? String(body.pageContext.parkingId) : null,
      bookingId: body.pageContext?.bookingId ? String(body.pageContext.bookingId) : null,
    };
    let attachedContext: Awaited<ReturnType<typeof verifyAttachedContextAccess>> = [];
    try {
      attachedContext = parseAttachedContextInput(body.attachedContext);
    } catch (err) {
      return jsonError(req, err instanceof Error ? err.message : 'Invalid attachedContext', 400);
    }

    if (!orgSlug) return jsonError(req, 'orgSlug is required', 400);
    if (regenerate && !conversationIdInput) {
      return jsonError(req, 'conversationId is required to regenerate', 400);
    }
    if (!regenerate && !message && incomingAttachments.length === 0) {
      return jsonError(req, 'message or attachments required', 400);
    }
    if (regenerate && incomingAttachments.length > 0) {
      return jsonError(req, 'attachments are not supported when regenerating', 400);
    }
    if (editMessageId && (regenerate || !conversationIdInput)) {
      return jsonError(req, 'editMessageId needs a conversationId and cannot regenerate', 400);
    }

    const orgCtx = await verifyOrgAccess(req, { orgSlug });
    try {
      attachedContext = await verifyAttachedContextAccess(req, attachedContext);
    } catch (err) {
      return jsonError(
        req,
        err instanceof Error ? err.message : 'Cannot access attached context',
        403
      );
    }
    const { permissions, propertyId: effectivePropertyId } = await resolveEffectivePermissions(
      req,
      orgCtx.accessKind,
      orgCtx.org.id,
      pageContext.propertyId
    );

    const [globalSettings, orgSettings] = await Promise.all([
      getDashboardAssistantGlobalSettings(),
      getDashboardAssistantOrgSettings(orgCtx.org.id),
    ]);
    if (!isDashboardAssistantAccessible(globalSettings, orgSettings, pageContext.propertyId)) {
      return jsonError(req, 'AI dashboard assistant is not enabled for this organization', 503);
    }

    // Phase 6 kill switches: org override wins, else the platform-wide default applies.
    const agenticModeEnabled = resolveDashboardAssistantKillSwitch(
      globalSettings.agenticModeEnabled,
      orgSettings.agenticModeEnabledOverride
    );
    const planApprovalEnabled = resolveDashboardAssistantKillSwitch(
      globalSettings.planApprovalEnabled,
      orgSettings.planApprovalEnabledOverride
    );
    // agentic_mode off caps a turn to one tool-calling round instead of disabling the assistant.
    const effectiveMaxRounds = agenticModeEnabled ? orgSettings.maxToolRounds : 1;

    if (pageContext.parkingId && !pageContext.propertyId) {
      // Parking routes: no property to check entitlements through, so gate directly on the org
      // (already-verified via verifyOrgAccess above) — property-independent, closes the
      // parking-property-parity.md interim-ungate blocker.
      try {
        await requireOrgFeature(orgCtx.org.id, 'aiDashboardAssistant');
      } catch (err) {
        if (err instanceof PlanFeatureRequiredError) {
          return jsonUpgradeHook(req, err.message, { feature: err.feature });
        }
        throw err;
      }
    } else if (effectivePropertyId) {
      try {
        await requirePropertyFeature(effectivePropertyId, 'aiDashboardAssistant');
      } catch (err) {
        if (err instanceof PlanFeatureRequiredError) {
          return jsonUpgradeHook(req, err.message, { feature: err.feature });
        }
        throw err;
      }
    } else {
      try {
        await requireOrgPropertyFeature(orgCtx.org.id, 'aiDashboardAssistant');
      } catch (err) {
        if (err instanceof PlanFeatureRequiredError) {
          return jsonUpgradeHook(req, err.message, { feature: err.feature });
        }
        throw err;
      }
    }

    const quota = await checkDashboardAssistantQuota(orgCtx.org.id, orgSettings);
    if (!quota.allowed) {
      return jsonSuccess(req, {
        conversationId: conversationIdInput,
        blocks: [
          {
            type: 'text',
            text: `You've reached the ${quota.reason === 'daily_limit' ? 'daily' : 'monthly'} message limit for the AI assistant.`,
          },
        ],
        upgradeHook: true,
      });
    }

    const sb = createServiceClient();
    const turnAbort = new AbortController();
    const linkRequestAbort = () => {
      if (!turnAbort.signal.aborted) turnAbort.abort();
    };
    req.signal.addEventListener('abort', linkRequestAbort, { once: true });

    let conversationId = conversationIdInput;
    if (conversationId) {
      const { data: existing } = await sb
        .from('ai_dashboard_assistant_conversations')
        .select('id, user_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (!existing || existing.user_id !== user.id) {
        return jsonError(req, 'Conversation not found', 404);
      }
    } else {
      const { data: created, error } = await sb
        .from('ai_dashboard_assistant_conversations')
        .insert({
          organization_id: orgCtx.org.id,
          user_id: user.id,
          property_id: effectivePropertyId,
          title: (message || incomingAttachments[0]?.name || 'New conversation').slice(0, 80),
        })
        .select('id')
        .single();
      if (error || !created) {
        return jsonError(
          req,
          `Failed to create conversation: ${error?.message ?? 'unknown error'}`,
          500
        );
      }
      conversationId = created.id;
    }

    let storedAttachments: Awaited<ReturnType<typeof persistAssistantAttachments>>['stored'] = [];
    let attachmentParts: Awaited<ReturnType<typeof persistAssistantAttachments>>['geminiParts'] =
      [];
    let userMessageRow: { id: string };
    let turnMessage = message;
    /** Host-facing text stored in the thread — never persist tool/instruction prompts as the bubble. */
    let persistedUserText = displayMessage || message;
    /** True when this request inserted the user row — safe to delete on abort. */
    let insertedUserMessageThisTurn = false;

    if (regenerate) {
      const { data: recentMessages, error: recentError } = await sb
        .from('ai_dashboard_assistant_messages')
        .select('id, role, content_text, attachments, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (recentError) {
        return jsonError(req, `Failed to load conversation: ${recentError.message}`, 500);
      }
      const lastUser = (recentMessages ?? []).find((row) => row.role === 'user');
      if (!lastUser) {
        return jsonError(req, 'No user message to regenerate from', 400);
      }
      const assistantIds = (recentMessages ?? [])
        .filter(
          (row) => row.role === 'assistant' && String(row.created_at) >= String(lastUser.created_at)
        )
        .map((row) => row.id);
      if (assistantIds.length > 0) {
        await sb.from('ai_dashboard_assistant_messages').delete().in('id', assistantIds);
      }
      await sb
        .from('ai_dashboard_assistant_pending_actions')
        .update({ status: 'expired' })
        .eq('message_id', lastUser.id)
        .eq('status', 'pending');

      userMessageRow = { id: lastUser.id };
      turnMessage = String(lastUser.content_text ?? '').trim() || message;
      storedAttachments = Array.isArray(lastUser.attachments)
        ? (lastUser.attachments as typeof storedAttachments)
        : [];
      if (storedAttachments.length > 0) {
        return jsonError(req, 'Regenerate is not available for messages with attachments', 400);
      }
      if (!turnMessage) {
        return jsonError(req, 'Cannot regenerate an empty message', 400);
      }
    } else {
      if (editMessageId) {
        const { data: edited, error: editedError } = await sb
          .from('ai_dashboard_assistant_messages')
          .select('id, role, conversation_id, created_at')
          .eq('id', editMessageId)
          .maybeSingle();
        if (
          editedError ||
          !edited ||
          edited.conversation_id !== conversationId ||
          edited.role !== 'user'
        ) {
          return jsonError(req, 'Message to edit was not found', 404);
        }
        const { data: dropped } = await sb
          .from('ai_dashboard_assistant_messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .gte('created_at', String(edited.created_at))
          .limit(500);
        const droppedIds = (dropped ?? []).map((row) => row.id as string);
        if (droppedIds.length > 0) {
          await sb
            .from('ai_dashboard_assistant_pending_actions')
            .update({ status: 'expired' })
            .in('message_id', droppedIds)
            .eq('status', 'pending');
          await sb.from('ai_dashboard_assistant_messages').delete().in('id', droppedIds);
        }
      }

      try {
        const persisted = await persistAssistantAttachments({
          organizationId: orgCtx.org.id,
          userId: user.id,
          conversationId,
          attachments: incomingAttachments,
        });
        storedAttachments = persisted.stored;
        attachmentParts = persisted.geminiParts;
      } catch (err) {
        return jsonError(
          req,
          err instanceof Error ? err.message : 'Failed to store attachments',
          400
        );
      }

      const { data: insertedUser, error: userMessageError } = await sb
        .from('ai_dashboard_assistant_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content_text: persistedUserText || null,
          blocks: [],
          attachments: storedAttachments,
        })
        .select('id')
        .single();
      if (userMessageError || !insertedUser) {
        return jsonError(
          req,
          `Failed to persist message: ${userMessageError?.message ?? 'unknown error'}`,
          500
        );
      }
      userMessageRow = insertedUser;
      insertedUserMessageThisTurn = true;
    }

    const attachedContextLine = attachedContextPromptLines(attachedContext);
    const attachedTemplate = await attachedTemplateContext(attachedContext);
    const attachmentLine =
      storedAttachments.length > 0
        ? `\nThe host attached ${storedAttachments.length} file(s) this turn - use these exact attachmentPath values with propose_apply_booking_attachment (never invent paths or https URLs):\n${storedAttachments
            .map(
              (a) =>
                `- name: ${inlineUntrusted(a.name)}; mimeType: ${a.mimeType}; attachmentPath: ${a.path}`
            )
            .join(
              '\n'
            )}\nWhen the host wants a file on a booking (approved GAF, valid ID, receipt, etc.), call propose_apply_booking_attachment. Set alsoMarkComplete=true only for approved_gaf/approved_pet when they also want that step marked complete. For "check this receipt" without uploading to the booking, run_receipt_validation is enough.`
        : '';

    const cacheKey = groundingCacheKey(orgCtx.org.id, user.id, effectivePropertyId, permissions);
    const [facts, conversationCtx] = await Promise.all([
      getCachedGroundingFacts(cacheKey, () =>
        buildHostSafeGroundingFacts(orgCtx.org.id, user.id, effectivePropertyId, permissions)
      ),
      loadConversationContext(sb, conversationId!, {
        excludeMessageId: userMessageRow.id,
      }).catch((err) => {
        console.warn(
          'dashboard-assistant-chat: conversation context load failed',
          err instanceof Error ? err.message : err
        );
        return {
          summary: '',
          priorHistory: [] as GeminiContent[],
          recentToolNames: [] as string[],
          knownFactsText: '',
          resumablePlanSteps: null,
        };
      }),
    ]);
    const groundingPrompt = hostSafeGroundingFactsToPrompt(facts);
    const conversationSummary = conversationCtx.summary;
    const priorHistory = conversationCtx.priorHistory;

    const isResumingPlan =
      turnMessage.trim() === CONTINUE_REST_ACTION.prompt &&
      !!conversationCtx.resumablePlanSteps &&
      conversationCtx.resumablePlanSteps.length > 0;
    const resumeNote = isResumingPlan
      ? '\n\nThis turn continues a plan that ran out of room last time - its open goals are already loaded below. Do not call plan_task again; just keep working the remaining open goals.'
      : '';
    const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nKnown facts:\n${groundingPrompt}\n\npageContext: ${JSON.stringify(pageContext)}${attachedContextLine}${attachedTemplate.promptText}${attachmentLine}${conversationContextPromptSection(conversationSummary)}${conversationCtx.knownFactsText}${resumeNote}`;

    /** True once the assistant reply + usage increment have been committed. */
    let turnCommitted = false;
    /** Tier-1 writes applied before abort during end-of-turn commit (partial cancel). */
    let partialAppliedEffects: AssistantAppliedEffect[] = [];

    const assertTurnActive = () => {
      if (turnAbort.signal.aborted || req.signal.aborted) {
        throw new AssistantTurnAbortedError(undefined, partialAppliedEffects);
      }
    };

    const cleanupAbortedTurn = async () => {
      if (turnCommitted || !insertedUserMessageThisTurn) return;
      if (partialAppliedEffects.length > 0) return;
      await sb.from('ai_dashboard_assistant_messages').delete().eq('id', userMessageRow.id);
    };

    const auditExecutedActions = async (
      actions: Array<{ toolName: string; result: ToolResult }>,
      ctx: ToolExecutionContext
    ) => {
      for (const action of actions) {
        await sb.from('ai_dashboard_assistant_action_audit').insert({
          organization_id: orgCtx.org.id,
          property_id: action.result.auditPropertyId ?? effectivePropertyId,
          booking_id: action.result.auditBookingId ?? null,
          user_id: user.id,
          conversation_id: conversationId,
          message_id: userMessageRow.id,
          tool_name: action.toolName,
          risk_tier: 'tier1_auto',
          input_payload: action.result.data ?? {},
          result_status: action.result.ok ? 'success' : 'failed',
          result_summary: action.result.error ?? null,
        });
        await logAssistantWriteActivity(ctx, action.toolName, action.result, 'tier1_auto');
      }
      if (actions.length > 0) {
        await incrementDashboardAssistantUsage(orgCtx.org.id, { writeAction: true });
      }
    };

    const tier1ConfirmationBlocks = (
      actions: Array<{ toolName: string; result: ToolResult }>
    ): ChatBlock[] =>
      actions.map((block) => {
        const payload = (block.result.data ?? {}) as Record<string, unknown>;
        return {
          type: 'action_confirmation' as const,
          actionId: crypto.randomUUID(),
          toolName: block.toolName,
          riskTier: 'tier1_auto' as const,
          summary: humanizeActionConfirmationSummary(
            block.toolName,
            String(payload.summary ?? buildTier1ActionSummary(block.toolName)),
            payload
          ),
          details: buildActionConfirmationDetails(block.toolName, payload),
          diff: buildActionConfirmationDiff(block.toolName, payload) ?? undefined,
          status: 'executed' as const,
        };
      });

    const runTurn = async (emit?: AssistantStreamEmitter) => {
      assertTurnActive();
      const deferredWrites: DeferredToolCall[] = [];
      const toolCtx: ToolExecutionContext = {
        req,
        organizationId: orgCtx.org.id,
        userId: user.id,
        userEmail: user.email ?? '',
        pageContext,
        attachedContext,
        isBulk: false,
        deferWritesUntilCommit: true,
        deferredWrites,
        conversationId: conversationId!,
        turnAttachmentPaths: storedAttachments.map((a) => a.path).filter(Boolean),
      };

      const userTurnText =
        turnMessage || (storedAttachments.length > 0 ? 'Please review the attached file(s).' : '');
      const history: GeminiContent[] = [
        ...fitHistoryToTokenBudget(priorHistory, PRIOR_HISTORY_TOKEN_BUDGET),
        { role: 'user', parts: [{ text: userTurnText }, ...attachmentParts] },
      ];
      // Phase 6 router: only the modules this turn needs (fails open to every tool).
      const recentToolNames = conversationCtx.recentToolNames;
      const toolRoute = routeAssistantModules({
        message: userTurnText,
        attachedTypes: attachedContext.map((item) => item.type),
        pageContext,
        recentToolNames: recentToolNames.slice(-12),
      });
      // Mutable: request_tools (below) widens this for later rounds of the same turn when the
      // router under-matched. Never shrinks, and never changes which model is in use mid-turn.
      let turnTools = [
        RESPOND_WITH_BLOCKS_DECLARATION,
        REQUEST_TOOLS_DECLARATION,
        PLAN_TASK_DECLARATION,
        ...selectToolDeclarations(TOOL_DECLARATIONS, toolRoute).filter(
          (tool) =>
            tool.name !== RESPOND_WITH_BLOCKS_NAME &&
            tool.name !== REQUEST_TOOLS_NAME &&
            tool.name !== PLAN_TASK_NAME
        ),
      ];
      timer.setModules(toolRoute.failOpen ? [] : toolRoute.modules);
      // Picked once, before the loop starts, and held for every round of this turn — never
      // mid-turn, since Gemini's thought signatures are only valid for the model that produced
      // them (docs/workflow/in-progress/agentic-ai-assistants.md, Phase 2 model policy).
      const turnFeature = resolveDashboardAssistantFeature({
        message: userTurnText,
        attachmentCount: storedAttachments.length,
        matchedModuleCount: toolRoute.failOpen ? 0 : toolRoute.modules.length,
        routerFailedOpen: toolRoute.failOpen,
      });
      const turnMaxOutputTokens = turnFeature === 'dashboard_assistant_complex' ? 4096 : 2048;
      // A Tier-2 proposal ends the turn's loop as soon as it's made (current, pre-plan-card
      // design) — if the message reads as 2+ asks, note that only one part is covered yet,
      // rather than silently dropping the rest when the model didn't declare a plan or bundle
      // every write into one round (docs/workflow/in-progress/agentic-ai-assistants.md, Phase 0).
      const turnHasMultipleIntents = countTurnIntents(userTurnText) >= 2;
      // Everything before the first model call: auth, entitlements, quota, conversation row,
      // attachments, grounding facts and prior-turn context.
      timer.record('preload', Date.now() - preloadStartedAt);
      const toolResultsForGrounding: unknown[] = [];
      /** Phase 4 working memory: entity refs this turn's successful tool calls touched. */
      const turnEntityRefs: EntityRef[] = [];
      /** `open_page` handoffs, appended as blocks after grounding (server-built hrefs only). */
      const openPageResults: Array<{ toolName: string; ok: boolean; data?: unknown }> = [];
      let proposedAction: { toolName: string; result: ToolResult } | null = null;
      /** Extra Tier-2 proposals beyond the first in the same round — never silently dropped. */
      const extraProposals: Array<{ toolName: string; result: ToolResult }> = [];
      let pendingActionId: string | null = null;
      /** Set instead of pendingActionId when 2+ write proposals land in one turn — Phase 3. */
      let planId: string | null = null;
      let executedActions: Array<{ toolName: string; result: ToolResult }> = [];
      let journeyGuidanceIntro: string | null = null;
      let finalText = '';
      /** Tool already produced host-facing copy (e.g. Meta attachment refuse) — skip block synth. */
      let skipBlockSynthWithText: string | null = null;
      let inlineSynthBlocks: unknown[] | null = null;
      let turnCreditsConsumed = 0;
      /** Set once a tool returned guest-written text; escalates later writes to Tier 2. */
      let untrustedContentRead = false;
      /** Knowledge-base rows read this turn; cited as "Related pages" after the safety check. */
      const knowledgeHits: Array<Record<string, unknown>> = [];
      const activity = new TurnActivityRecorder(emit);
      const taskPlan = new TurnTaskPlanRecorder(emit);
      // Phase 4 resumable turns: the "Continue with the rest" chip reseeds the plan from the
      // prior turn's unfinished task_plan block instead of the model re-planning from scratch.
      if (isResumingPlan && conversationCtx.resumablePlanSteps) {
        taskPlan.resumeFrom(conversationCtx.resumablePlanSteps);
      }
      const bulkLedger = new TurnLedger();
      /** Signatures of tool calls that already succeeded this turn — never rerun on a repeat. */
      const seenCallSignatures = new Set<string>();
      activity.recordPhase('understanding', 'Understood your question');

      for (let round = 0; round < effectiveMaxRounds; round++) {
        assertTurnActive();
        const streamLiveText = round > 0 && emit != null;
        let streamedPreview = '';
        const modelReq = {
          feature: turnFeature,
          prompt: DASHBOARD_ASSISTANT_PROMPT,
          system: systemPrompt,
          user: userTurnText,
          tools: turnTools,
          toolMode: 'auto' as const,
          history,
          maxOutputTokens: turnMaxOutputTokens,
          signal: turnAbort.signal,
          billing: {
            organizationId: orgCtx.org.id,
            propertyId: effectivePropertyId,
            actorUserId: user.id,
            actorType: 'staff' as const,
          },
        };
        const roundResult = await timer.measure('model', () =>
          streamLiveText
            ? generateWithToolsStream({
                ...modelReq,
                onTextDelta: (delta) => {
                  if (!streamedPreview) emit?.({ type: 'text_start' });
                  streamedPreview += delta;
                  emit?.({ type: 'text_chunk', delta });
                },
              })
            : generateWithTools(modelReq)
        );
        turnCreditsConsumed += roundResult.creditsConsumed;
        assertTurnActive();

        if (roundResult.toolCalls.length === 0) {
          finalText = roundResult.text ?? '';
          break;
        }
        if (streamedPreview) {
          emit?.({
            type: 'retract',
            fallbackText: 'Working on the next step.',
          });
        }

        // Turn-level, not per-round: a write is judged against every write and every
        // guest-text read this whole turn, so spreading writes across rounds cannot dodge
        // escalation (docs/workflow/in-progress/agentic-ai-assistants.md, Phase 0).
        toolCtx.isBulk = bulkLedger.planRound(
          roundResult.toolCalls.map((tc) => tc.name),
          (name) => WRITE_TOOL_NAMES.has(name)
        );

        history.push({
          role: 'model',
          parts:
            roundResult.modelParts && roundResult.modelParts.length > 0
              ? roundResult.modelParts
              : roundResult.toolCalls.map((tc) => ({
                  functionCall: { name: tc.name, args: tc.arguments },
                })),
        });

        const responseParts: GeminiContent['parts'] = [];
        let shortCircuit = false;
        /** Any real (non-meta) tool call that succeeded this round — advances a declared goal. */
        let anyToolSucceededThisRound = false;

        taskPlan.initFromToolCalls(roundResult.toolCalls, round);

        for (const [callIndex, call] of roundResult.toolCalls
          .slice(0, MAX_TOOL_CALLS_PER_ROUND)
          .entries()) {
          assertTurnActive();
          const stepId = `r${round}-t${callIndex}`;
          const toolStartedAt = Date.now();
          activity.recordToolStart(call.name, stepId);
          taskPlan.markRunning(stepId);
          if (call.name === RESPOND_WITH_BLOCKS_NAME) {
            const rawBlocks = call.arguments.blocks;
            inlineSynthBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
            timer.markSynthInline();
            activity.recordToolComplete(call.name, true, toolStartedAt, stepId, undefined, {
              omitFromTimeline: true,
            });
            taskPlan.markDone(stepId, true);
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { result: { ok: true }, error: null },
              },
            });
            shortCircuit = true;
            continue;
          }
          if (call.name === PLAN_TASK_NAME) {
            const goals = Array.isArray(call.arguments.goals)
              ? call.arguments.goals.map((g: unknown) => String(g))
              : [];
            taskPlan.declareGoals(goals);
            activity.recordToolComplete(call.name, true, toolStartedAt, stepId, undefined, {
              omitFromTimeline: true,
            });
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { result: { ok: true, goalCount: goals.length }, error: null },
              },
            });
            continue;
          }
          if (call.name === REQUEST_TOOLS_NAME) {
            const outcome = widenToolsForModules(
              turnTools,
              TOOL_DECLARATIONS,
              Array.isArray(call.arguments.modules) ? call.arguments.modules : []
            );
            turnTools = outcome.tools;
            activity.recordToolComplete(call.name, true, toolStartedAt, stepId, undefined, {
              omitFromTimeline: true,
            });
            taskPlan.markDone(stepId, true);
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: {
                  result: {
                    addedModules: outcome.addedModules,
                    alreadyHadAll: outcome.alreadyHadAll,
                    unknownModules:
                      outcome.unknownModules.length > 0 ? outcome.unknownModules : undefined,
                  },
                  error: null,
                },
              },
            });
            continue;
          }
          const callSig = callSignature(call);
          if (seenCallSignatures.has(callSig)) {
            // The model already made this exact call (same tool, same arguments) earlier this
            // turn and it succeeded — never run a write (or any call) twice over a repeated round.
            activity.recordToolComplete(call.name, true, toolStartedAt, stepId, undefined, {
              omitFromTimeline: true,
            });
            taskPlan.markDone(stepId, true);
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: {
                  result: null,
                  error:
                    'Skipped: you already made this exact call in this turn. Use the earlier result, or change the arguments.',
                },
              },
            });
            continue;
          }
          const result = await timer.measureTool(call.name, () =>
            executeTool(call.name, call.arguments, toolCtx)
          );
          if (result.ok) {
            seenCallSignatures.add(callSig);
            anyToolSucceededThisRound = true;
          }
          const failureReason = result.ok ? undefined : hostFacingToolFailureReason(result.error);
          activity.recordToolComplete(call.name, result.ok, toolStartedAt, stepId, failureReason, {
            omitFromTimeline: result.ok && result.deferred === true,
          });
          taskPlan.markDone(stepId, result.ok, failureReason);
          toolResultsForGrounding.push(result.data ?? result.error);
          if (result.ok) {
            turnEntityRefs.push(...extractEntityRefs(call.name, result.data));
          }
          if (call.name === 'open_page') {
            openPageResults.push({ toolName: call.name, ok: result.ok, data: result.data });
          }
          if (call.name === 'search_knowledge_base' && Array.isArray(result.data)) {
            knowledgeHits.push(...(result.data as Array<Record<string, unknown>>));
          }
          const carriesGuestText = UNTRUSTED_CONTENT_TOOL_NAMES.has(call.name);
          if (carriesGuestText) {
            untrustedContentRead = true;
            bulkLedger.markUntrustedRead();
          }
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: {
                // Model-facing copy is size-bounded; grounding keeps the full data.
                result: result.data == null ? null : boundToolResult(result.data),
                error: result.ok
                  ? null
                  : `${result.error ?? ''} ${modelFacingToolFailureHint(classifyToolFailure(result.error))}`.trim(),
                // Marks data the system prompt says must never be followed as instructions.
                ...(carriesGuestText ? { dataOrigin: 'contains_guest_written_text' } : {}),
              },
            },
          });

          if (!result.ok && result.data && isBookingJourneyRecord(result.data) && result.error) {
            journeyGuidanceIntro = result.error;
            if (!toolResultsForGrounding.some(isBookingJourneyRecord)) {
              toolResultsForGrounding.push(result.data);
            }
          }

          if (result.proposed) {
            // First proposal in the turn wins the card; later ones are never silently dropped.
            if (proposedAction) {
              extraProposals.push({ toolName: call.name, result });
            } else {
              proposedAction = { toolName: call.name, result };
            }
            shortCircuit = true;
          } else if (
            !result.ok &&
            typeof result.error === 'string' &&
            /Attachments are only supported for website chat/i.test(result.error)
          ) {
            // Deterministic Meta attachment refusal — do not open a confirm card.
            finalText = result.error;
            skipBlockSynthWithText = result.error;
            shortCircuit = true;
          } else if (WRITE_TOOL_NAMES.has(call.name) && result.ok && !result.deferred) {
            executedActions.push({ toolName: call.name, result });
          }
        }

        if (anyToolSucceededThisRound) taskPlan.advanceDeclaredGoal();

        // Calls beyond the per-round budget get an explicit error response (in call order).
        for (const call of roundResult.toolCalls.slice(MAX_TOOL_CALLS_PER_ROUND)) {
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: {
                result: null,
                error: `Skipped: at most ${MAX_TOOL_CALLS_PER_ROUND} tool calls per step. Ask for the rest separately.`,
              },
            },
          });
        }

        history.push({ role: 'user', parts: responseParts });

        if (shortCircuit) break;
        if (
          round === effectiveMaxRounds - 1 ||
          estimateHistoryTokens(history) > TURN_HISTORY_TOKEN_BUDGET ||
          !turnDeadline.hasRoomForAnotherRound() ||
          turnCreditsConsumed >= orgSettings.turnCreditCeiling
        ) {
          const openStepsNote = describeOpenPlanSteps(taskPlan.getOpenSteps());
          // Phase 7 telemetry: the completion check (above) found an open goal when the turn ran
          // out of rounds/budget — see dashboardAssistantTurnTiming.ts#completion_check_miss.
          if (openStepsNote) timer.markCompletionCheckMiss();
          const base =
            (roundResult.text ?? '').trim() ||
            (finalText || '').trim() ||
            summarizeGatheredToolResults(toolResultsForGrounding) ||
            openStepsNote ||
            'I gathered part of that.';
          const gathered =
            openStepsNote && base !== openStepsNote ? `${base} ${openStepsNote}` : base;
          finalText = gathered;
          skipBlockSynthWithText = gathered;
          inlineSynthBlocks = [
            { type: 'text', text: gathered },
            {
              type: 'quick_actions',
              actions: [{ ...CONTINUE_REST_ACTION }],
            },
          ];
          break;
        }
      }

      assertTurnActive();
      if (!proposedAction) {
        const markQuery = parseMarkMaintenanceDoneQuery(userTurnText);
        if (markQuery) {
          let match = pickOpenMaintenanceItem(toolResultsForGrounding, markQuery);
          if (!match) {
            const listed = await executeTool('list_maintenance_items', { q: markQuery }, toolCtx);
            if (listed.ok && listed.data) toolResultsForGrounding.push(listed.data);
            match = pickOpenMaintenanceItem(toolResultsForGrounding, markQuery);
          }
          const propertyId = toolCtx.pageContext.propertyId;
          if (match && propertyId) {
            const result = await executeTool(
              'propose_update_maintenance_item',
              { id: match.id, propertyId, completed: true },
              toolCtx
            );
            if (result.proposed) {
              proposedAction = { toolName: 'propose_update_maintenance_item', result };
            }
          }
        }
      }
      const blocks: ChatBlock[] = [];

      if (
        planApprovalEnabled &&
        proposedAction &&
        (extraProposals.length > 0 || deferredWrites.length > 0)
      ) {
        // Phase 3 plan-card approval: 2+ write proposals (Tier-2, plus any Tier-1 writes that
        // were queued for deferred commit) in one turn become ONE approvable plan instead of a
        // single card plus inert "held back, nothing applied" text
        // (docs/workflow/in-progress/agentic-ai-assistants.md, Phase 3 item 2). A Tier-1 step
        // joins the plan pre-ticked (selected: true) — it stays low risk, it just no longer
        // auto-commits on its own once a Tier-2 card exists alongside it this turn.
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared a plan for your review');

        type PlanDraftStep = {
          toolName: string;
          riskTier: 'tier1_auto' | 'tier2_confirmed';
          /** What executeConfirmedAction (tier2) / executeTool (tier1) expects at confirm time. */
          inputPayload: Record<string, unknown>;
          /** Unscoped payload for host-facing summary/details/diff building. */
          displayPayload: Record<string, unknown>;
        };
        const draftSteps: PlanDraftStep[] = [
          {
            toolName: proposedAction.toolName,
            riskTier: 'tier2_confirmed',
            inputPayload: withAssistantScope(
              (proposedAction.result.data ?? {}) as Record<string, unknown>,
              { pageContext, attachedContext }
            ),
            displayPayload: (proposedAction.result.data ?? {}) as Record<string, unknown>,
          },
          ...extraProposals.map((p) => ({
            toolName: p.toolName,
            riskTier: 'tier2_confirmed' as const,
            inputPayload: withAssistantScope((p.result.data ?? {}) as Record<string, unknown>, {
              pageContext,
              attachedContext,
            }),
            displayPayload: (p.result.data ?? {}) as Record<string, unknown>,
          })),
          ...deferredWrites.map((dw) => ({
            toolName: dw.toolName,
            riskTier: 'tier1_auto' as const,
            // Scope-embedded like every Tier-2 step so dashboard-assistant-confirm can strip it
            // uniformly regardless of risk tier (stripAssistantScopeFromPayload is already
            // tier-agnostic on the single-action path).
            inputPayload: withAssistantScope(dw.args, { pageContext, attachedContext }),
            displayPayload: dw.args,
          })),
        ];
        // Deferred Tier-1 writes are now plan steps, not an end-of-turn auto-commit queue — clear
        // the shared array so the later commitDeferredTier1Writes call (structured-synth branch
        // only, never reached from this branch anyway) never double-runs them.
        deferredWrites.length = 0;

        const { kept: planSteps, overflow } = capPlanSteps(draftSteps, orgSettings.maxPlanSteps);

        const { data: planRow, error: planError } = await sb
          .from('ai_dashboard_assistant_action_plans')
          .insert({
            conversation_id: conversationId,
            message_id: userMessageRow.id,
            organization_id: orgCtx.org.id,
            property_id: effectivePropertyId ?? null,
            parking_id: pageContext.parkingId ?? null,
            user_id: user.id,
            status: 'proposed',
          })
          .select('id')
          .single();
        if (planError || !planRow) {
          throw new Error(
            `Failed to persist action plan: ${planError?.message ?? 'unknown error'}`
          );
        }
        planId = planRow.id as string;
        // Phase 7 telemetry: how many steps this turn's plan card proposed.
        timer.setPlanSize(planSteps.length);

        const { data: insertedSteps, error: stepsError } = await sb
          .from('ai_dashboard_assistant_pending_actions')
          .insert(
            planSteps.map((step, idx) => ({
              conversation_id: conversationId,
              message_id: userMessageRow.id,
              user_id: user.id,
              tool_name: step.toolName,
              input_payload: step.inputPayload,
              risk_tier: step.riskTier,
              plan_id: planId,
              step_index: idx,
              depends_on: findStepDependencies(step.inputPayload),
              selected: true,
            }))
          )
          .select('id, step_index');
        if (stepsError || !insertedSteps) {
          throw new Error(
            `Failed to persist plan steps: ${stepsError?.message ?? 'unknown error'}`
          );
        }
        const stepRowIdByIndex = new Map(
          insertedSteps.map((r) => [r.step_index as number, r.id as string])
        );

        blocks.push({
          type: 'action_plan',
          planId,
          status: 'proposed',
          steps: planSteps.map((step, idx) => ({
            stepId: stepRowIdByIndex.get(idx) as string,
            stepIndex: idx,
            toolName: step.toolName,
            riskTier: step.riskTier,
            summary: humanizeActionConfirmationSummary(
              step.toolName,
              String(step.displayPayload.summary ?? ''),
              step.displayPayload
            ),
            details: buildActionConfirmationDetails(step.toolName, step.displayPayload),
            diff: buildActionConfirmationDiff(step.toolName, step.displayPayload) ?? undefined,
            dependsOn: findStepDependencies(step.inputPayload),
            selected: true,
            status: 'proposed' as const,
            isExternalSend: isExternalSendTool(step.toolName),
          })),
        });

        if (overflow > 0) {
          blocks.push({
            type: 'text',
            text: `This plan covers the first ${planSteps.length} steps. Approve these, then ask for the rest.`,
          });
        }

        for (const step of planSteps) {
          if (step.toolName === 'propose_transition_booking') {
            const bookingId = String(step.displayPayload.bookingId ?? '').trim();
            if (bookingId && !toolResultsForGrounding.some(isBookingJourneyRecord)) {
              const booking = await DatabaseService.getBookingById(bookingId);
              if (booking) {
                toolResultsForGrounding.push(
                  buildBookingJourneyData(booking as Record<string, unknown>)
                );
              }
            }
          }
        }

        const openGoalsAfterPlan = taskPlan.getOpenSteps();
        if (openGoalsAfterPlan.length > 0) {
          const labels = openGoalsAfterPlan.map((step) => step.label.replace(/[.!?]+$/, ''));
          blocks.push({
            type: 'text',
            text: `Also still to do: ${labels.join(', ')}. I'll get to that after you review this plan.`,
          });
        }

        taskPlan.markSynthDone();
        timer.setGuardMode('none');
        const proposedBlocks = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(proposedBlocks, taskPlan));
      } else if (proposedAction) {
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared action for your review');
        const { data: pendingRow, error: pendingError } = await sb
          .from('ai_dashboard_assistant_pending_actions')
          .insert({
            conversation_id: conversationId,
            message_id: userMessageRow.id,
            user_id: user.id,
            tool_name: proposedAction.toolName,
            input_payload: withAssistantScope(
              (proposedAction.result.data ?? {}) as Record<string, unknown>,
              { pageContext, attachedContext }
            ),
            risk_tier: 'tier2_confirmed',
          })
          .select('id')
          .single();
        if (pendingError || !pendingRow) {
          throw new Error(
            `Failed to persist pending action: ${pendingError?.message ?? 'unknown error'}`
          );
        }
        pendingActionId = pendingRow.id as string;
        const payload = (proposedAction.result.data ?? {}) as Record<string, unknown>;
        blocks.push({
          type: 'action_confirmation',
          actionId: pendingRow.id,
          toolName: proposedAction.toolName,
          riskTier: 'tier2_confirmed',
          summary: humanizeActionConfirmationSummary(
            proposedAction.toolName,
            String(payload.summary ?? ''),
            payload
          ),
          details: buildActionConfirmationDetails(proposedAction.toolName, payload),
          diff: buildActionConfirmationDiff(proposedAction.toolName, payload) ?? undefined,
          status: 'proposed',
          isExternalSend: isExternalSendTool(proposedAction.toolName),
        });

        if (proposedAction.toolName === 'propose_transition_booking') {
          const bookingId = String(payload.bookingId ?? '').trim();
          if (bookingId && !toolResultsForGrounding.some(isBookingJourneyRecord)) {
            const booking = await DatabaseService.getBookingById(bookingId);
            if (booking) {
              toolResultsForGrounding.push(
                buildBookingJourneyData(booking as Record<string, unknown>)
              );
            }
          }
        }

        const heldBack = buildHeldBackBlocks({
          proposalSummaries: extraProposals.map((p) => {
            const extraPayload = (p.result.data ?? {}) as Record<string, unknown>;
            return humanizeActionConfirmationSummary(
              p.toolName,
              String(extraPayload.summary ?? ''),
              extraPayload
            );
          }),
          queuedWriteLabels: deferredWrites.map((dw) => buildTier1ActionSummary(dw.toolName)),
        });
        blocks.push(...heldBack);

        // A Tier-2 proposal ends the loop before a later declared goal was even attempted (not
        // bundled into the same round as this one) — name it so it's queued, not silently lost.
        const openGoalsAfterProposal = taskPlan.getOpenSteps();
        if (openGoalsAfterProposal.length > 0) {
          const labels = openGoalsAfterProposal.map((step) => step.label.replace(/[.!?]+$/, ''));
          blocks.push({
            type: 'text',
            text: `Also still to do: ${labels.join(', ')}. I'll get to that after you confirm this one.`,
          });
        } else if (
          turnHasMultipleIntents &&
          extraProposals.length === 0 &&
          deferredWrites.length === 0
        ) {
          // No plan was declared and nothing else already named the rest — the model proposed
          // just the first part of a multi-ask message. Say plainly that more is still open
          // rather than letting the card imply the whole request was handled.
          blocks.push({
            type: 'text',
            text: 'This covers one part of your request. Confirm this, then ask for the rest next.',
          });
        }

        taskPlan.markSynthDone();
        timer.setGuardMode('none');
        const proposedBlocks = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(proposedBlocks, taskPlan));
      } else if (skipBlockSynthWithText && !inlineSynthBlocks) {
        // Host-facing tool refusal already set (e.g. Meta attachment refuse).
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared your answer');
        blocks.push({ type: 'text', text: skipBlockSynthWithText.trim() });
        taskPlan.markSynthDone();
        timer.setGuardMode('none');
        const answered = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(answered, taskPlan));
      } else {
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared your answer');
        const groundingText = `${groundingPrompt}\n${JSON.stringify(toolResultsForGrounding)}${attachmentLine}${attachedContextLine}${attachedTemplate.promptText}`;
        let modelBlocks: unknown[] = inlineSynthBlocks ?? [];
        let draftText: string | null | undefined = finalText || skipBlockSynthWithText;
        if (
          canSkipStructuredSynth({
            hasInlineBlocks: Boolean(inlineSynthBlocks),
            hasToolResults: toolResultsForGrounding.length > 0,
            hasDraftText: Boolean((finalText || '').trim()),
          })
        ) {
          if (!inlineSynthBlocks) timer.markSynthInline();
        } else {
          // Empty turn: no tools, no draft, no respond_with_blocks. Last-resort structured synth.
          const structured = await timer.measure('synth', () =>
            generateStructuredViaTool({
              feature: 'dashboard_assistant',
              prompt: DASHBOARD_ASSISTANT_BLOCKS_PROMPT,
              system: systemPrompt,
              user: userTurnText,
              history:
                history.length > 0
                  ? [
                      ...history,
                      {
                        role: 'user',
                        parts: [
                          {
                            text: 'Summarize the tool results above as chat blocks for the host.',
                          },
                        ],
                      },
                    ]
                  : undefined,
              maxOutputTokens: 2048,
              signal: turnAbort.signal,
              jsonSchema: BLOCKS_RESPONSE_SCHEMA,
              schema: z.object({
                blocks: z.array(z.custom<ChatBlock>((v) => Boolean(v) && typeof v === 'object')),
              }),
              billing: {
                organizationId: orgCtx.org.id,
                propertyId: effectivePropertyId,
                actorUserId: user.id,
                actorType: 'staff',
              },
            })
          );
          turnCreditsConsumed += structured.creditsConsumed;
          assertTurnActive();
          modelBlocks = structured.data?.blocks ?? [];
          draftText = finalText || structured.text;
        }

        const shaped = shapeCandidateBlocks({
          modelBlocks,
          draftText,
          toolResults: toolResultsForGrounding,
          groundingText,
          userMessage: turnMessage,
          attachedContext,
          attachedTemplateText: attachedTemplate.fallbackText,
        });
        const safeBlocks = shaped.blocks;

        const combinedText = safeBlocks
          .map((b) => ('text' in b ? b.text : 'summary' in b ? b.summary : ''))
          .join(' ');
        const quickScan = quickSafetyScan(combinedText);
        let safetyApproved = false;
        if (!quickScan.ok) {
          timer.setGuardMode('blocked');
          blocks.push({
            type: 'text',
            text: "I can't share that. It touches something outside what I'm allowed to discuss.",
          });
        } else {
          assertTurnActive();
          const runLlmGuard = shouldRunLlmGuard({
            untrustedContentRead,
            hasProposal: Boolean(proposedAction),
            hasDeferredWrites: deferredWrites.length > 0,
            hasExecutedWrites: executedActions.length > 0,
            quickScanFailed: false,
            groundingRejected: !shaped.grounded,
            answerText: combinedText,
            groundingText,
          });
          if (!runLlmGuard) {
            timer.setGuardMode('deterministic');
            blocks.push(...safeBlocks);
            safetyApproved = true;
          } else {
            timer.setGuardMode('llm');
            const safetyCheck = await timer.measure('guard', () =>
              guardDashboardAssistantResponse(
                {
                  organizationId: orgCtx.org.id,
                  propertyId: effectivePropertyId,
                  actorUserId: user.id,
                  actorType: 'staff',
                  signal: turnAbort.signal,
                },
                combinedText,
                groundingText
              )
            );
            turnCreditsConsumed += safetyCheck.creditsConsumed;
            assertTurnActive();
            if (!safetyCheck.ok) {
              blocks.push({
                type: 'text',
                text: "I can't share that response. It didn't pass a safety check.",
              });
            } else {
              blocks.push(...safeBlocks);
              safetyApproved = true;
            }
          }
          if (safetyApproved) {
            const citations =
              knowledgeHits.length > 0 && !safeBlocks.some((b) => b.type === 'link_list')
                ? knowledgeSourceLinks(knowledgeHits, {
                    orgSlug,
                    propertySlug: await propertySlugFor(effectivePropertyId),
                  })
                : null;
            if (citations) blocks.push(citations);
          }
        }
        activity.recordPhase('safety', 'Checked response safety');
        taskPlan.markSynthDone();

        if (
          safetyApproved &&
          deferredWrites.length > 0 &&
          (await remainingDashboardAssistantWrites(orgCtx.org.id, orgSettings)) <
            deferredWrites.length
        ) {
          // Daily write cap reached: commit nothing (all-or-nothing keeps the turn coherent).
          deferredWrites.length = 0;
          blocks.push({ type: 'text', text: DASHBOARD_ASSISTANT_WRITE_LIMIT_MESSAGE });
        }

        if (safetyApproved && deferredWrites.length > 0) {
          activity.recordPhase('tool', 'Applying changes');
          emit?.({ type: 'phase', phase: 'executing', label: 'Applying changes' });
          const commitResult = await commitDeferredTier1Writes({
            ctx: toolCtx,
            deferredWrites,
            writeToolNames: WRITE_TOOL_NAMES,
            isAborted: () => turnAbort.signal.aborted || req.signal.aborted,
            onToolStart: (toolName) => activity.recordToolStart(toolName),
            onToolDone: (toolName, ok) => activity.recordToolComplete(toolName, ok, Date.now()),
          });
          executedActions.push(...commitResult.executed);
          if (commitResult.executed.length > 0) invalidateGroundingCache(orgCtx.org.id);
          partialAppliedEffects = commitResult.appliedEffects;
          if (commitResult.abortedMidCommit) {
            await auditExecutedActions(commitResult.executed, toolCtx);
            throw new AssistantTurnAbortedError(undefined, commitResult.appliedEffects);
          }
          blocks.push(...tier1ConfirmationBlocks(commitResult.executed));
        }

        const withActivity = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(withActivity, taskPlan));
      }

      assertTurnActive();

      const commitStartedAt = Date.now();
      await auditExecutedActions(executedActions, toolCtx);

      const finalizedBlocks = finalizeResponseBlocks({
        blocks,
        toolResults: toolResultsForGrounding,
        userMessage: turnMessage,
        attachedContext,
        journeyIntroText: journeyGuidanceIntro,
        executedToolNames: executedActions.map((action) => action.toolName),
      });
      const fromTools = openPageBlocksFromResults(openPageResults);
      const intentPage =
        fromTools.length > 0
          ? null
          : openPageBlockFromUserIntent(turnMessage, {
              orgSlug,
              propertySlug: await propertySlugFor(effectivePropertyId),
            });
      const handoffBlocks = intentPage ? [...fromTools, intentPage] : fromTools;
      const merged: ChatBlock[] = intentPage
        ? [
            ...finalizedBlocks.filter(
              (block) => block.type !== 'data_table' && block.type !== 'stat_list'
            ),
            ...handoffBlocks,
          ]
        : [...finalizedBlocks, ...handoffBlocks];
      const responseBlocks: ChatBlock[] = appendLeadChips(merged, turnMessage);

      // Persisted breakdown excludes the commit itself (it cannot time its own insert); the
      // `turn_timing` SSE event / JSON `timing` field carry the complete figure.
      timer.addCredits(turnCreditsConsumed);
      const persistedTiming = timer.snapshot();
      const { data: assistantRow } = await sb
        .from('ai_dashboard_assistant_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content_text: finalText || null,
          blocks: responseBlocks,
          // Audit copy only (never fed back to the model) — contact / identity fields redacted.
          tool_calls:
            toolResultsForGrounding.length > 0
              ? redactSensitiveFields(toolResultsForGrounding)
              : [],
          latency_breakdown: persistedTiming,
          guard_mode: persistedTiming.guard_mode,
          entity_refs: capEntityRefs(dedupeEntityRefs(turnEntityRefs)),
        })
        .select('id')
        .single();

      if (pendingActionId && assistantRow?.id) {
        await sb
          .from('ai_dashboard_assistant_pending_actions')
          .update({ message_id: assistantRow.id })
          .eq('id', pendingActionId);
      }

      if (planId && assistantRow?.id) {
        await sb
          .from('ai_dashboard_assistant_action_plans')
          .update({ message_id: assistantRow.id })
          .eq('id', planId);
        await sb
          .from('ai_dashboard_assistant_pending_actions')
          .update({ message_id: assistantRow.id })
          .eq('plan_id', planId);
      }

      await sb
        .from('ai_dashboard_assistant_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      await incrementDashboardAssistantUsage(orgCtx.org.id, {
        message: true,
        creditsConsumed: turnCreditsConsumed,
      });

      turnCommitted = true;
      timer.record('commit', Date.now() - commitStartedAt);
      return {
        conversationId: conversationId!,
        blocks: responseBlocks,
        messageId: (assistantRow?.id as string | undefined) ?? undefined,
        userMessageId: userMessageRow.id,
        timing: timer.snapshot(),
        hadPendingAction: Boolean(pendingActionId),
      };
    };

    if (wantsAssistantStream(req, body as { stream?: boolean })) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = createAssistantStreamEmitter(controller, {
            isAborted: () => turnAbort.signal.aborted,
          });
          void (async () => {
            try {
              // Emit early so the client can recover via regenerate if the stream is cut
              // (e.g. local functions serve hot-reload → ERR_INCOMPLETE_CHUNKED_ENCODING).
              emit({ type: 'turn_started', conversationId: conversationId! });
              const result = await runTurn(emit);
              await streamAssistantTextPreview(emit, result.blocks, {
                signal: turnAbort.signal,
              });
              // Always deliver terminal blocks once the turn is committed, even if the
              // host cancelled during the text preview delay window.
              emit({ type: 'turn_timing', timing: result.timing });
              emit({
                type: 'blocks',
                conversationId: result.conversationId,
                blocks: result.blocks,
                messageId: result.messageId,
                userMessageId: result.userMessageId,
              });
              await capturePostHogEvent('ai_assistant_turn_completed', {
                logPrefix: 'dashboard-assistant-chat',
                request: req,
                distinctId: user.id,
                groups: { organization: orgCtx.org.id },
                properties: { had_pending_action: result.hadPendingAction },
              });
              controller.close();
            } catch (err) {
              if (isAssistantTurnAbortedError(err)) {
                await cleanupAbortedTurn();
                const appliedEffects =
                  err instanceof AssistantTurnAbortedError ? err.appliedEffects : undefined;
                emit({
                  type: 'error',
                  message: 'Turn cancelled',
                  aborted: true,
                  appliedEffects,
                });
                try {
                  controller.close();
                } catch {
                  /* already closed */
                }
                return;
              }
              const aiBlocker = aiDisabledScope(err);
              emit({
                type: 'error',
                message:
                  aiBlocker === 'platform'
                    ? AI_OFF_BY_PLATFORM_MESSAGE
                    : err instanceof Error
                      ? err.message
                      : 'Turn failed',
                ...(aiBlocker ? { aiBlocker } : {}),
              });
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            }
          })();
        },
        cancel() {
          linkRequestAbort();
        },
      });
      return assistantStreamResponse(req, stream);
    }

    try {
      const result = await runTurn();
      await capturePostHogEvent('ai_assistant_turn_completed', {
        logPrefix: 'dashboard-assistant-chat',
        request: req,
        distinctId: user.id,
        groups: { organization: orgCtx.org.id },
        properties: { had_pending_action: result.hadPendingAction },
      });
      return jsonSuccess(req, {
        conversationId: result.conversationId,
        blocks: result.blocks,
        messageId: result.messageId,
        userMessageId: result.userMessageId,
        timing: result.timing,
      });
    } catch (err) {
      if (isAssistantTurnAbortedError(err)) {
        await cleanupAbortedTurn();
        return jsonError(req, 'Turn cancelled', 499);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof PlanFeatureRequiredError) {
      return jsonUpgradeHook(req, err.message, { feature: err.feature });
    }
    if (isAiQuotaError(err)) {
      return jsonResponse(
        req,
        { success: false, error: (err as Error).message, upgradeHook: true },
        429
      );
    }
    const aiBlocker = aiDisabledScope(err);
    if (aiBlocker) {
      return jsonResponse(
        req,
        {
          success: false,
          error: aiBlocker === 'platform' ? AI_OFF_BY_PLATFORM_MESSAGE : (err as Error).message,
          aiBlocker,
        },
        503
      );
    }
    return handleEdgeError(req, err, 'dashboard-assistant-chat');
  }
});
