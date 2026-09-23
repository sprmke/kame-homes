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
  incrementDashboardAssistantUsage,
  isDashboardAssistantAccessible,
} from '../_shared/dashboardAssistantSettings.ts';
import {
  isExternalSendTool,
  TIER1_ONLY_TOOL_NAMES,
  TIER2_ONLY_TOOL_NAMES,
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
  TOOL_DECLARATIONS,
  type ToolExecutionContext,
  type ToolResult,
} from '../_shared/dashboardAssistantTools.ts';
import {
  callGeminiStructured,
  callGeminiToolCall,
  type GeminiContent,
} from '../_shared/geminiToolCallClient.ts';
import {
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

const MAX_TOOL_ROUNDS = 4;
const WRITE_TOOL_NAMES = new Set([
  ...TIER1_ONLY_TOOL_NAMES,
  ...TIER2_ONLY_TOOL_NAMES,
  'propose_transition_booking',
]);

const BLOCKS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'text',
              'booking_card',
              'stat_list',
              'data_table',
              'link_list',
              'file_list',
              'image',
              'flow',
              'diagram',
              'map',
              'quick_actions',
              'dynamic_form',
            ],
          },
          text: { type: 'string' },
          bookingId: { type: 'string' },
          guestName: { type: 'string' },
          status: { type: 'string' },
          checkIn: { type: 'string' },
          checkOut: { type: 'string' },
          propertyName: { type: 'string' },
          balanceDue: { type: 'number', nullable: true },
          title: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, value: { type: 'string' } },
              required: ['label', 'value'],
            },
          },
          columns: { type: 'array', items: { type: 'string' } },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cells: { type: 'array', items: { type: 'string' } },
              },
              required: ['cells'],
            },
          },
          links: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, href: { type: 'string' } },
              required: ['label', 'href'],
            },
          },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                url: { type: 'string' },
                kind: { type: 'string', enum: ['image', 'pdf', 'file'] },
              },
              required: ['label', 'url'],
            },
          },
          url: { type: 'string' },
          alt: { type: 'string' },
          format: { type: 'string', enum: ['mermaid', 'text'] },
          source: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          href: { type: 'string' },
          lat: { type: 'number', nullable: true },
          lng: { type: 'number', nullable: true },
          label: { type: 'string' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, prompt: { type: 'string' } },
              required: ['label', 'prompt'],
            },
          },
          description: { type: 'string' },
          submitLabel: { type: 'string' },
          toolName: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fieldType: {
                  type: 'string',
                  enum: [
                    'text',
                    'textarea',
                    'number',
                    'select',
                    'radio',
                    'date',
                    'email',
                    'tel',
                    'checkbox',
                  ],
                },
                key: { type: 'string' },
                label: { type: 'string' },
                placeholder: { type: 'string' },
                required: { type: 'boolean' },
                min: { type: 'number', nullable: true },
                max: { type: 'number', nullable: true },
                maxLength: { type: 'number', nullable: true },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { value: { type: 'string' }, label: { type: 'string' } },
                    required: ['value', 'label'],
                  },
                },
              },
              required: ['fieldType', 'key', 'label'],
            },
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['blocks'],
};

const SYSTEM_PROMPT_PREFIX = `You are the AI dashboard assistant for property hosts. Answer only from the Known facts, Conversation so far, and tool results below — never invent booking data, amounts, guest names, inbox threads, maintenance items, team members, or marketing assets. Never claim an action succeeded unless a tool call actually returned success. When you need live data, call a tool instead of guessing. Financially-sensitive, destructive, or override actions require host confirmation — you do not need to warn about this, the platform handles it. Respond with a short set of typed blocks (text/booking_card/stat_list/data_table/link_list/file_list/image/flow/diagram/map/quick_actions/dynamic_form) — never HTML or markdown tables.

Collecting structured input (dynamic_form):
- When a tool needs 2+ pieces of structured information the host hasn't given yet (e.g. propose_create_support_ticket's category/subject/description/severity), emit a single dynamic_form block instead of asking for each field one at a time in text. Do not also restate the fields as text — the form is the question.
- Each field: fieldType (text/textarea/number/select/radio/date/email/tel/checkbox), key (short camelCase, matches the tool's parameter name), label (host-facing, no field-name jargon), required, and for select/radio an options[] of { value, label } using the tool's actual enum values and human labels — never invent options.
- Use the field type that matches the data: short single-line answers → text; a paragraph → textarea; a fixed set of choices (support ticket category, severity) → select or radio (radio for 2-4 short options, select for more); amounts/counts → number; dates → date; email/phone → email/tel.
- Support ticket fields: category as select — bug_report "Broken", feature_suggestion "Idea", general_inquiry "Question", business_inquiry "Business"; subject as text; description as textarea; severity (bug_report only) as select — low "Not urgent", medium "Soon", high "Blocking me"; contactPreference (business_inquiry only) as text.
- Set toolName to the tool you intend to call. After the host taps Submit you'll receive their answers as a normal message on the next turn — call that tool then with the values they gave you, do not ask again.
- Only one dynamic_form per turn. If some fields are already known (from this conversation or attachedContext), omit those and only ask for what's missing — or skip the form entirely and call the tool directly once you have everything.

Accuracy & tone (all modules — non-negotiable):
- Never tell the host a booking, guest, file, inbox thread, maintenance item, team member, parking booking, finance row, marketing template, or other record "doesn't exist" / "I don't see it" if it appeared earlier in this conversation (Conversation so far), in attachedContext, or in any tool result this turn — including when it is the wrong status for their requested action.
- "Can't do X yet" ≠ "missing". If the host asks to complete, cancel, refund, publish, send, reply, invite, or mark done and the target exists but is blocked, say so clearly: name the entity (use hostLabel), current status/state, why the action is blocked, what is still pending, and the next valid step.
- Prefer short, direct, confident copy. No apologetic filler. No inventing absences.
- Continuity: reuse names, statuses, and choices from Conversation so far. If the host says "that one", "this guest", "the thread", or "same as before", resolve from prior turns + attachedContext before asking again.

Bookings-specific:
- When the host picks a suggested stay by guest name, look it up with list_bookings(guestName=…) without a status filter first (or get_booking if you already have bookingId from tools). Do not filter list_bookings to READY_FOR_CHECKOUT / COMPLETED just because they said "complete".
- When the host asks to guide them through a booking's remaining steps, call plan_booking_journey. Do not invent a stepper — the platform renders it from that tool.
- When the host asks to complete, advance, finish, or mark a booking done and no booking is pinned / named, call list_bookings first (no status filter). Reply with a short text asking which stay, a data_table of guest + dates + status, and quick_actions whose labels copy hostLabel. Never invent booking numbers or "Booking 1234" chips.
- Booking status changes are multi-step. Before propose_transition_booking, call plan_booking_journey or get_available_transitions. Only propose the immediate next valid transition — never skip stages (e.g. Pending Review → Completed). If they asked to "complete" a stay that is still early in the pipeline, say it is not ready for Completed yet, show the journey, and offer to advance to the next status.
- Pending tasks and SD refund amounts come from get_booking (pendingTasks, sdRefundAmount) — copy those, do not invent an empty list.
- For booked or available dates, call get_available_dates and use bookedStays / availableRanges.
- When the host asks to see, provide, open, or show a booking file (approved GAF, pet form, receipt, ID, parking endorsement), call get_booking_documents (kinds: gaf/pet/receipt/id/parking) and emit a file_list using the exact url values from the tool. Never invent URLs. If documents is empty, say the file is not on this booking. Do not answer a file request with only a booking_card.
- When the host attaches a file and wants it on a booking (approved GAF, valid ID, receipt, parking docs, etc.), call propose_apply_booking_attachment with the exact attachmentPath from Known facts — never invent paths or https URLs. Use alsoMarkComplete only for approved_gaf/approved_pet when they also want that step marked complete.
- When the host asks to send/resend a workflow email (GAF request, pet request, acknowledgement, ready-for-check-in, Check-out Instructions), call propose_send_workflow_email with the matching kind.
- When the host wants to set the organization logo from a chat image, call propose_apply_org_logo.
- When they want a chat image/video on the property gallery, call propose_apply_property_media (optional setPrimary). For a parking cover photo, propose_apply_parking_media.
- For GAF unit owner signature or external review images/stay photos, call propose_apply_app_settings_attachment (never GCash QR — that needs the payment OTP flow in Settings).
- For standard template section/inline images, call propose_apply_template_attachment.
- Support tickets: list_support_tickets / get_support_ticket / propose_create_support_ticket (optional attachmentPaths). When the host wants to file one and hasn't given category/subject/description yet, use a dynamic_form (see above) instead of asking one at a time.
- Announcements: list_host_announcements / get_host_announcement. Plan: get_org_plan_snapshot.
- Inbox replies may include attachmentPaths for **web** chat only — Meta DMs stay text-only.
- Channel sync: get_channel_sync_status then propose_run_channel_sync. Public pages: get_public_pages_status / propose_update_public_page_template.
- Finance/maintenance updates/deletes: propose_update_finance_line_item, propose_delete_finance_line_item, propose_update_maintenance_item, propose_delete_maintenance_item.
- Org verification: apply proofs with propose_apply_org_verification_attachment (valid ID, social proof, selfie, platform admin, etc.); when ready, propose_submit_org_verification (base or enhanced — enhanced needs a selfie with ID). Owner-only.
- Listing authorization: propose_apply_listing_authorization_attachment for proof files; propose_submit_listing_authorization with relationship (+ contractEndDate when required). Owner-only.
- GCash QR: propose_stage_gcash_qr stages an image only — never commits payment_methods. Host must still complete OTP in Payment settings.
- Notifications: get_notification_preferences / guide_notification_settings (Web Push + deep-link; no per-event matrix API yet). Telegram: get_telegram_notification_settings / guide_telegram_settings — credential writes stay in Notifications UI.
- New booking: guide_create_booking (deep-link to Bookings → New booking modal + checklist). No chat create/edit — booking field edits use BookingEditForm in UI only.
- Import CSV: guide_import_bookings — wizard stays in Import modal (preview + confirm); never auto-commit from chat.
- Marketing publish: propose_publish_to_meta accepts mediaUrl or attachmentPath (upload on confirm, same as marketing media). Canvas/template pixel edits stay in Marketing Studio UI.
- Analytics: get_property_analytics for this property's occupancy/ADR/RevPAR/revenue KPIs, the forward occupancy + balance-collection state, pace, the vs-Kame-median benchmark (only when benchmark.available is true — otherwise say a benchmark isn't available yet, never invent one), and matched Playbook articles (Pro plan only — surface the upgrade message as-is if it returns one). Answer with (1) a short text block giving the state/headline in words (no exact figures in this block) and (2) a stat_list using the tool's own occupancyRatePct/adrDisplay/revparDisplay/grossRevenueDisplay/reservations/benchmark.medianOccupancyRatePct/benchmark.occupancyPercentile values — never restate a specific number in the text block, put every figure (including benchmark percentiles) in the stat_list only. explain_metric for a plain-language definition of a metric (occupancy, ADR, RevPAR, pickup, the state labels, etc.) — no property lookup needed, plain text answer is fine (no numbers to ground). Never estimate or round an analytics figure yourself — use exactly what the tool returned.

Other modules (same intelligence):
- Inbox: list/get threads with list_inbox_threads / get_inbox_thread; use hostLabel (participant · platform). propose_send_inbox_reply sends a real guest message (external_send) — optional attachmentPath(s) from this conversation work on website chat only; Meta DMs are text-only. After opening a thread, suggest next moves (Reply, Mark read, Show older messages) — never re-offer the same thread chip the host just picked.
- Help & Support: list_support_tickets / get_support_ticket; create with propose_create_support_ticket (+ optional attachmentPath(s)). Use hostLabel (subject · status).
- Announcements: list_host_announcements / get_host_announcement for active platform/development banners hosts see in the dashboard.
- Plans: get_org_plan_snapshot for current plan name, enrolled properties, and feature entitlements — checkout/billing changes still require the Plans page.
- Maintenance: list items with list_maintenance_items; use hostLabel (title · state). After selecting one, suggest useful next actions (Mark complete, Edit notes, Show due this week) — not the same item chip again.
- Team: list members/invites with list_team_members / list_property_team_members; chips use hostLabel (name · role). Follow-ups are invite/remove/role actions, not re-picking the same person.
- Parking: list_parking_bookings / list_parkings use hostLabel the same way as property bookings.
- Marketing: list_marketing_templates / publish history — chips use template/platform hostLabel; after pick, offer preview/publish/history — not the same template chip.
- Finance / profit questions: call get_finance_summary (defaults to this calendar month for the current property). Answer with (1) a short text block naming the property and date range, plus a one-line plain-language breakdown, and (2) a stat_list using display.* values (₱) for Total Income, Total Expenses, and Net Profit. Use netProfit — never "Grand Net", never raw unformatted numbers.

Host-facing rules:
- Always use human status labels from tool results (statusLabel), never raw codes like READY_FOR_CHECKOUT.
- Never emit an empty stat_list, data_table, link_list, file_list, or dynamic_form (no fields). If a list is empty, say so in a text block.
- For data_table, every row must include cells[] in the same order as columns. Example: columns ["Guest","Check-in","Check-out","Status"], rows [{cells:["Jane","Aug 19","Aug 20","Pending Review"]}]. Prefer including Status when listing bookings.
- For photos or design previews, emit an image block using the exact url from a tool result (never invent URLs).
- For step-by-step process guidance, prefer flow with concise steps (3-8 steps).
- For schema/relationship visuals, use diagram with format mermaid when possible; keep source concise and readable.
- For location guidance, use map with the exact grounded link (href) plus label; include lat/lng only when known from facts or tool results.
- quick_actions are short follow-up chips: label (host-facing) + prompt (sent to the assistant). Tapping a chip sends immediately — do not treat them as already executed. Copy hostLabel from tool results for entity-specific chips — never use bookingId, internal numbers, UUIDs, property IDs, or raw status codes in labels. Prompts may name the entity in plain language so the next turn can find it.
- After the host selects an entity (any module), emit quick_actions that are the next useful moves — never re-offer the same hostLabel chip they just selected or typed.
- Scope: when pageContext.propertyId is set, answer for that property only unless the host clearly asks about another property or the whole organization. Prefer omitting propertyId on tools so the platform uses pageContext.`;

async function resolveEffectivePermissions(
  req: Request,
  accessKind: string,
  propertyId: string | null | undefined
): Promise<{ permissions: string[]; propertyId: string | null }> {
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
            .map((a) => `- name: ${a.name}; mimeType: ${a.mimeType}; attachmentPath: ${a.path}`)
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
      actions: Array<{ toolName: string; result: ToolResult }>
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
        ...priorHistory,
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
      const activity = new TurnActivityRecorder(emit);
      const taskPlan = new TurnTaskPlanRecorder(emit);
      activity.recordPhase('understanding', 'Understood your question');

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        assertTurnActive();
        const roundResult = await callGeminiToolCall({
          feature: 'dashboard_assistant',
          organizationId: orgCtx.org.id,
          propertyId: effectivePropertyId,
          systemPrompt,
          userPrompt: userTurnText,
          tools: TOOL_DECLARATIONS,
          toolMode: 'auto',
          history,
          cacheDisabled: true,
          maxOutputTokens: 1024,
          actorUserId: user.id,
          actorType: 'staff',
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
        toolCtx.isBulk =
          writeCallCount > 1 || (roundResult.toolCalls.length >= 2 && writeCallCount >= 1);

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

        for (const [callIndex, call] of roundResult.toolCalls.entries()) {
          assertTurnActive();
          const stepId = `r${round}-t${callIndex}`;
          const toolStartedAt = Date.now();
          activity.recordToolStart(call.name, stepId);
          taskPlan.markRunning(stepId);
          const result = await executeTool(call.name, call.arguments, toolCtx);
          activity.recordToolComplete(call.name, result.ok, toolStartedAt, stepId);
          taskPlan.markDone(stepId, result.ok);
          toolResultsForGrounding.push(result.data ?? result.error);
          responseParts.push({
            functionResponse: {
              name: call.name,
              response: { result: result.data ?? null, error: result.error ?? null },
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

        history.push({ role: 'user', parts: responseParts });

        if (shortCircuit) break;
        if (round === MAX_TOOL_ROUNDS - 1) {
          finalText =
            'I gathered some information but need another prompt to finish — could you ask again?';
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
        const structured = await callGeminiStructured<{ blocks: ChatBlock[] }>(
          {
            feature: 'dashboard_assistant',
            organizationId: orgCtx.org.id,
            propertyId: effectivePropertyId,
            systemPrompt,
            userPrompt: userTurnText,
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
            cacheDisabled: true,
            maxOutputTokens: 1024,
            actorUserId: user.id,
            actorType: 'staff',
          },
          BLOCKS_RESPONSE_SCHEMA
        );
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
            text: "I can't share that — it touched something outside what I'm allowed to discuss.",
          });
        } else {
          assertTurnActive();
          const safetyCheck = await guardDashboardAssistantResponse(
            {
              organizationId: orgCtx.org.id,
              propertyId: effectivePropertyId,
              actorUserId: user.id,
              actorType: 'staff',
            },
            combinedText,
            groundingPrompt
          );
          turnCreditsConsumed += safetyCheck.creditsConsumed;
          assertTurnActive();
          if (!safetyCheck.ok) {
            blocks.push({
              type: 'text',
              text: "I can't share that response — it didn't pass a safety check.",
            });
          } else {
            blocks.push(...safeBlocks);
            safetyApproved = true;
          }
        }
        activity.recordPhase('safety', 'Checked response safety');
        taskPlan.markSynthDone();

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
            await auditExecutedActions(commitResult.executed);
            throw new AssistantTurnAbortedError(undefined, commitResult.appliedEffects);
          }
          blocks.push(...tier1ConfirmationBlocks(commitResult.executed));
        }

        const withActivity = prependActivityTimeline(blocks, activity);
        blocks.length = 0;
        blocks.push(...prependTaskPlan(withActivity, taskPlan));
      }

      assertTurnActive();

      await auditExecutedActions(executedActions);

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
        tool_calls: toolResultsForGrounding.length > 0 ? toolResultsForGrounding : [],
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
