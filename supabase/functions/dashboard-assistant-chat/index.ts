/**
 * dashboard-assistant-chat — main AI dashboard assistant turn endpoint.
 * Docs: docs/workflow/planned/ai-dashboard-assistant.md §1 (turn flow), §2 (tools), §5 (guardrails).
 *
 * Body: { conversationId?, orgSlug, pageContext: { propertyId?, bookingId? }, attachedContext?: AttachedContextItem[], message, displayMessage?, attachments?: [{ name, mimeType, dataBase64 }], stream?: boolean, regenerate?: boolean }
 *
 * `displayMessage` (optional) is the host-facing text stored on the user row / shown in History.
 * `message` is what the model receives for this turn (may include richer chip guidance).
 * Never persist tool-name / system-instruction prompts as the visible user bubble.
 *
 * `regenerate: true` reuses the last user message in `conversationId`, deletes later assistant
 * rows, and does not insert a duplicate user message. Attachments are not supported on regenerate.
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
} from '../_shared/dashboardAssistantSettings.ts';
import {
  isExternalSendTool,
  TIER1_ONLY_TOOL_NAMES,
  TIER2_ONLY_TOOL_NAMES,
  UNTRUSTED_CONTENT_TOOL_NAMES,
} from '../_shared/dashboardAssistantRiskClassifier.ts';
import { isAiPlatformDisabledError, isAiQuotaError } from '../_shared/aiUsageService.ts';
import {
  buildActionConfirmationDetails,
  buildTier1ActionSummary,
  humanizeActionConfirmationSummary,
  isBookingJourneyRecord,
} from '../_shared/dashboardAssistantActionDisplay.ts';
import {
  humanizeStatusCodesInText,
  finalizeAssistantBlocksForHost,
  hydrateAssistantBlocksFromTools,
  knowledgeSourceLinks,
  nestBookingJourneyStepper,
  sanitizeAssistantChatBlocks,
  buildBookingJourneyData,
  wrapBlocksWithJourneyGuidance,
} from '../_shared/dashboardAssistantBlocks.ts';
import {
  conversationContextPromptSection,
  loadConversationContext,
} from '../_shared/dashboardAssistantConversationContext.ts';
import {
  assertBlocksGrounded,
  guardDashboardAssistantResponse,
  quickSafetyScan,
  type ChatBlock,
} from '../_shared/dashboardAssistantSafetyGuard.ts';
import {
  parseIncomingAttachments,
  persistAssistantAttachments,
} from '../_shared/dashboardAssistantAttachments.ts';
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
  SYSTEM_PROMPT_PREFIX,
} from '../_shared/ai/prompts/dashboardAssistant.ts';

const MAX_TOOL_ROUNDS = 4;
/** Host message cap — bounds prompt size / cost before any context is loaded. */
const MAX_MESSAGE_CHARS = 4_000;
/** Per-round tool budget — bounds latency/cost when the model fans out many calls at once. */
const MAX_TOOL_CALLS_PER_ROUND = 8;
/** Prior-conversation share of the context window (oldest turns drop first). */
const PRIOR_HISTORY_TOKEN_BUDGET = 8_000;
/** Whole-turn input budget; once tool results exceed it the turn stops calling tools and answers. */
const TURN_HISTORY_TOKEN_BUDGET = 60_000;
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
      permissions: [
        'bookings:view',
        'bookings.create:add',
        'bookings.import:add',
        'bookings.detail.stay:edit',
        'bookings.detail.guests:edit',
        'bookings.detail.parking:edit',
        'bookings.detail.pets:edit',
        'bookings.detail.pricing:edit',
        'bookings.detail.workflow:edit',
        'finance:view',
        'finance.transactions:add',
        'finance.transactions:edit',
        'finance.transactions:delete',
        'finance.export:view',
        'maintenance:view',
        'maintenance.reminders:add',
        'maintenance.reminders:edit',
        'maintenance.reminders:delete',
        'maintenance.export:view',
        'pricing:view',
        'pricing.rates:edit',
        'pricing.blocks:add',
        'pricing.blocks:delete',
      ],
      propertyId: propertyId ?? null,
    };
  }
  if (propertyId) {
    const access = await verifyPropertyAccess(req, propertyId);
    return { permissions: access.permissions, propertyId: access.property.id };
  }
  return { permissions: [], propertyId: null };
}

serveAuthenticated('dashboard-assistant-chat', async (req, user) => {
  try {
    requireHttpMethod(req, 'POST');

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

    const facts = await buildHostSafeGroundingFacts(
      orgCtx.org.id,
      user.id,
      effectivePropertyId,
      permissions
    );
    const groundingPrompt = hostSafeGroundingFactsToPrompt(facts);
    const attachedContextLine = attachedContextPromptLines(attachedContext);
    const attachmentLine =
      storedAttachments.length > 0
        ? `\nThe host attached ${storedAttachments.length} file(s) this turn — use these exact attachmentPath values with propose_apply_booking_attachment (never invent paths or https URLs):\n${storedAttachments
            .map(
              (a) =>
                `- name: ${inlineUntrusted(a.name)}; mimeType: ${a.mimeType}; attachmentPath: ${a.path}`
            )
            .join(
              '\n'
            )}\nWhen the host wants a file on a booking (approved GAF, valid ID, receipt, etc.), call propose_apply_booking_attachment. Set alsoMarkComplete=true only for approved_gaf/approved_pet when they also want that step marked complete. For "check this receipt" without uploading to the booking, run_receipt_validation is enough.`
        : '';

    let conversationSummary = '';
    let priorHistory: GeminiContent[] = [];
    try {
      const loaded = await loadConversationContext(sb, conversationId!, {
        excludeMessageId: userMessageRow.id,
      });
      conversationSummary = loaded.summary;
      priorHistory = loaded.priorHistory;
    } catch (err) {
      console.warn(
        'dashboard-assistant-chat: conversation context load failed',
        err instanceof Error ? err.message : err
      );
    }

    const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nKnown facts:\n${groundingPrompt}\n\npageContext: ${JSON.stringify(pageContext)}${attachedContextLine}${attachmentLine}${conversationContextPromptSection(conversationSummary)}`;

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
      const toolResultsForGrounding: unknown[] = [];
      let proposedAction: { toolName: string; result: ToolResult } | null = null;
      let executedActions: Array<{ toolName: string; result: ToolResult }> = [];
      let journeyGuidanceIntro: string | null = null;
      let finalText = '';
      /** Tool already produced host-facing copy (e.g. Meta attachment refuse) — skip block synth. */
      let skipBlockSynthWithText: string | null = null;
      let turnCreditsConsumed = 0;
      /** Set once a tool returned guest-written text; escalates later writes to Tier 2. */
      let untrustedContentRead = false;
      /** Knowledge-base rows read this turn; cited as "Related pages" after the safety check. */
      const knowledgeHits: Array<Record<string, unknown>> = [];
      const activity = new TurnActivityRecorder(emit);
      const taskPlan = new TurnTaskPlanRecorder(emit);
      activity.recordPhase('understanding', 'Understood your question');

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        assertTurnActive();
        const roundResult = await generateWithTools({
          feature: 'dashboard_assistant',
          prompt: DASHBOARD_ASSISTANT_PROMPT,
          system: systemPrompt,
          user: userTurnText,
          tools: TOOL_DECLARATIONS,
          toolMode: 'auto',
          history,
          maxOutputTokens: 1024,
          // Stop / disconnect cancels the in-flight model request, not just the next round.
          signal: turnAbort.signal,
          billing: {
            organizationId: orgCtx.org.id,
            propertyId: effectivePropertyId,
            actorUserId: user.id,
            actorType: 'staff',
          },
        });
        turnCreditsConsumed += roundResult.creditsConsumed;
        assertTurnActive();

        if (roundResult.toolCalls.length === 0) {
          finalText = roundResult.text ?? '';
          break;
        }

        const writeCallCount = roundResult.toolCalls.filter((tc) =>
          WRITE_TOOL_NAMES.has(tc.name)
        ).length;
        // Force host confirmation for multi-write rounds, and for every write after this turn
        // has read guest-written content (injected instructions must never auto-execute).
        toolCtx.isBulk =
          untrustedContentRead ||
          writeCallCount > 1 ||
          (roundResult.toolCalls.length >= 2 && writeCallCount >= 1);

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

        taskPlan.initFromToolCalls(roundResult.toolCalls, round);

        for (const [callIndex, call] of roundResult.toolCalls
          .slice(0, MAX_TOOL_CALLS_PER_ROUND)
          .entries()) {
          assertTurnActive();
          const stepId = `r${round}-t${callIndex}`;
          const toolStartedAt = Date.now();
          activity.recordToolStart(call.name, stepId);
          taskPlan.markRunning(stepId);
          const result = await executeTool(call.name, call.arguments, toolCtx);
          activity.recordToolComplete(call.name, result.ok, toolStartedAt, stepId);
          taskPlan.markDone(stepId, result.ok);
          toolResultsForGrounding.push(result.data ?? result.error);
          if (call.name === 'search_knowledge_base' && Array.isArray(result.data)) {
            knowledgeHits.push(...(result.data as Array<Record<string, unknown>>));
          }
          const carriesGuestText = UNTRUSTED_CONTENT_TOOL_NAMES.has(call.name);
          if (carriesGuestText) untrustedContentRead = true;
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: {
                // Model-facing copy is size-bounded; grounding keeps the full data.
                result: result.data == null ? null : boundToolResult(result.data),
                error: result.error ?? null,
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
            proposedAction = { toolName: call.name, result };
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
          round === MAX_TOOL_ROUNDS - 1 ||
          estimateHistoryTokens(history) > TURN_HISTORY_TOKEN_BUDGET
        ) {
          finalText =
            'I gathered some information but need another prompt to finish. Could you ask again?';
          break;
        }
      }

      assertTurnActive();
      const blocks: ChatBlock[] = [];

      if (proposedAction) {
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

        taskPlan.markSynthDone();
        const proposedBlocks = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(proposedBlocks, taskPlan));
      } else if (skipBlockSynthWithText) {
        // Host-facing tool refusal already set (e.g. Meta attachment refuse).
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared your answer');
        blocks.push({ type: 'text', text: skipBlockSynthWithText.trim() });
        taskPlan.markSynthDone();
        const answered = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(answered, taskPlan));
      } else {
        taskPlan.markSynthRunning();
        activity.recordPhase('synthesizing', 'Prepared your answer');
        // Final structured block synthesis — reuses the accumulated tool-call history so blocks
        // are grounded in what actually happened this turn, not a fresh guess.
        const structured = await generateStructuredViaTool({
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
                        text: finalText
                          ? `Summarize for the host as chat blocks. Draft: ${finalText}`
                          : 'Summarize the tool results above as chat blocks for the host.',
                      },
                    ],
                  },
                ]
              : undefined,
          maxOutputTokens: 1024,
          signal: turnAbort.signal,
          jsonSchema: BLOCKS_RESPONSE_SCHEMA,
          // Structural contract only; every block is sanitized + grounded below.
          schema: z.object({
            blocks: z.array(z.custom<ChatBlock>((v) => Boolean(v) && typeof v === 'object')),
          }),
          billing: {
            organizationId: orgCtx.org.id,
            propertyId: effectivePropertyId,
            actorUserId: user.id,
            actorType: 'staff',
          },
        });
        turnCreditsConsumed += structured.creditsConsumed;
        assertTurnActive();

        const candidateBlocks = hydrateAssistantBlocksFromTools(
          sanitizeAssistantChatBlocks(
            structured.data?.blocks?.length
              ? structured.data.blocks
              : [
                  {
                    type: 'text' as const,
                    text: finalText || structured.text || "I couldn't generate a response.",
                  },
                ]
          ),
          toolResultsForGrounding,
          turnMessage,
          { attachedContext }
        );

        const groundingText = `${groundingPrompt}\n${JSON.stringify(toolResultsForGrounding)}${attachmentLine}${attachedContextLine}`;
        const grounded = assertBlocksGrounded(candidateBlocks, groundingText);
        const safeBlocks = sanitizeAssistantChatBlocks(
          grounded.ok
            ? candidateBlocks
            : candidateBlocks.filter((_, i) => !grounded.rejectedIndexes.includes(i))
        );
        if (safeBlocks.length === 0) {
          safeBlocks.push({
            type: 'text',
            text: humanizeStatusCodesInText(
              finalText || "I couldn't format that answer. Please ask again."
            ),
          });
        }

        const combinedText = safeBlocks
          .map((b) => ('text' in b ? b.text : 'summary' in b ? b.summary : ''))
          .join(' ');
        const quickScan = quickSafetyScan(combinedText);
        let safetyApproved = false;
        if (!quickScan.ok) {
          blocks.push({
            type: 'text',
            text: "I can't share that. It touches something outside what I'm allowed to discuss.",
          });
        } else {
          assertTurnActive();
          const safetyCheck = await guardDashboardAssistantResponse(
            {
              organizationId: orgCtx.org.id,
              propertyId: effectivePropertyId,
              actorUserId: user.id,
              actorType: 'staff',
              signal: turnAbort.signal,
            },
            combinedText,
            groundingPrompt
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
            const citations =
              knowledgeHits.length > 0 && !safeBlocks.some((b) => b.type === 'link_list')
                ? knowledgeSourceLinks(knowledgeHits, {
                    orgSlug,
                    propertySlug: await propertySlugFor(effectivePropertyId),
                  })
                : null;
            if (citations) blocks.push(citations);
            safetyApproved = true;
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
          activity.recordPhase('executing', 'Applying changes');
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

      await auditExecutedActions(executedActions, toolCtx);

      const responseBlocks = finalizeAssistantBlocksForHost(
        wrapBlocksWithJourneyGuidance(
          nestBookingJourneyStepper(blocks, toolResultsForGrounding, attachedContext),
          toolResultsForGrounding,
          { introText: journeyGuidanceIntro, userMessage: turnMessage }
        ),
        toolResultsForGrounding,
        attachedContext,
        { userMessage: turnMessage }
      );

      await sb.from('ai_dashboard_assistant_messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content_text: finalText || null,
        blocks: responseBlocks,
        // Audit copy only (never fed back to the model) — contact / identity fields redacted.
        tool_calls:
          toolResultsForGrounding.length > 0 ? redactSensitiveFields(toolResultsForGrounding) : [],
      });

      await sb
        .from('ai_dashboard_assistant_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      await incrementDashboardAssistantUsage(orgCtx.org.id, {
        message: true,
        creditsConsumed: turnCreditsConsumed,
      });

      turnCommitted = true;
      return { conversationId, blocks: responseBlocks };
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
              emit({
                type: 'blocks',
                conversationId: result.conversationId,
                blocks: result.blocks,
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
              emit({
                type: 'error',
                message: err instanceof Error ? err.message : 'Turn failed',
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
      return jsonSuccess(req, { conversationId: result.conversationId, blocks: result.blocks });
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
    if (isAiPlatformDisabledError(err)) {
      return jsonError(req, (err as Error).message, 503);
    }
    return handleEdgeError(req, err, 'dashboard-assistant-chat');
  }
});
