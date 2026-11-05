import type {
  AssistantSuggestion,
  AssistantSuggestionKind,
} from '@/features/dashboard/ai-assistant/lib/assistantSuggestions';
import {
  ATTACHED_CONTEXT_TYPES,
  type AttachedContextType,
} from '@/features/dashboard/ai-assistant/lib/attachedContext';

/**
 * Per-module starter prompts for the AI dashboard assistant.
 *
 * Each list is ranked **most common → least common** (index 0 = rank 1) based on the
 * real tool catalog (`supabase/functions/_shared/dashboardAssistant*Tools.ts`) so every
 * prompt maps to something the assistant can actually answer or do. When the host pins
 * context from the composer (booking, property, finance item, …), `selectContextualSuggestions`
 * swaps the generic random pool (`assistantSuggestions.ts`) for the ranked prompts of the
 * pinned module(s) — merging fairly by rank when multiple modules are pinned together.
 *
 * Keep in sync with `docs/architecture/ai-dashboard-assistant.md` § Context model.
 */
const MODULE_PROMPTS: Record<
  AttachedContextType,
  { questions: readonly string[]; actions: readonly string[] }
> = {
  booking: {
    questions: [
      "What's the status of this booking?",
      'What can I do next with this booking?',
      'Is this booking waiting on any documents?',
      'Does this guest still have a balance due?',
      'Why is this booking stuck?',
      "What does this booking's status mean?",
      "Guide me through this booking's remaining steps",
      "Re-check this booking's payment receipts",
    ],
    actions: [
      'Move this booking to the next status',
      'Approve this booking',
      'Mark documents as received and move forward',
      'Start the SD refund for this booking',
      'Cancel this booking',
      'Re-run receipt validation on this booking',
      'Send a workflow email for this booking',
    ],
  },
  property: {
    questions: [
      "What's the occupancy for this property this month?",
      "What's this property's income and expenses this month?",
      "Who's on this property's team?",
      "What's this property's nightly rate?",
      'What dates are open on this property this month?',
      "What are this property's current settings?",
      "Is this property's listing verified?",
    ],
    actions: [
      "Update this property's profile",
      "Update this property's settings",
      'Invite a team member to this property',
      "Update this property's logo or photos",
      'Run channel sync for this property',
      'Submit listing authorization for this property',
    ],
  },
  parking_booking: {
    questions: [
      "What's the status of this parking booking?",
      'What can I do next with this parking booking?',
      "What's the rate for this parking booking?",
      'Is this parking slot still available?',
      "Why hasn't this parking booking been claimed?",
    ],
    actions: [
      'Claim this parking booking',
      'Decline this parking booking',
      'Move this parking booking to the next status',
      'Set a rate override for this parking slot',
      'Cancel this parking booking',
    ],
  },
  team_member: {
    questions: [
      "What's this team member's role?",
      'What can this team member access?',
      "Is this team member's invitation still pending?",
    ],
    actions: [
      "Change this team member's role",
      'Remove this team member',
      "Resend this team member's invitation",
      "Revoke this team member's invitation",
    ],
  },
  finance_item: {
    questions: [
      "What's this month's income and expenses?",
      "Show this month's finance by booking",
      'Which stays still have a balance due?',
      "What's my net income this month?",
      'What does this transaction cover?',
      "What's the breakdown of income vs expenses?",
    ],
    actions: [
      'Add a finance line item',
      'Update this transaction',
      'Record a new expense',
      'Record a new payment',
      'Delete this transaction',
    ],
  },
  maintenance_item: {
    questions: [
      'What maintenance is still open?',
      "What's the maintenance summary this month?",
      'Which maintenance items are overdue?',
      "What's the status of this maintenance item?",
      "Who's assigned to this maintenance item?",
    ],
    actions: [
      'Create a maintenance reminder',
      'Update this maintenance item',
      'Mark this maintenance item as done',
      'Reassign this maintenance item',
      'Delete this maintenance item',
    ],
  },
  pricing_date: {
    questions: [
      "What's the nightly rate for this date?",
      'Is this date blocked or available?',
      "What's the rate for this weekend?",
      'What dates are still open this month?',
      'Are there any holiday rules on this date?',
      'Compare weekday and weekend rates',
    ],
    actions: [
      'Set a rate override for this date',
      'Block this date',
      'Unblock this date',
      'Update the base rate',
      'Add a holiday pricing rule',
    ],
  },
  inbox_conversation: {
    questions: [
      'What does this inbox thread need?',
      'What inbox threads need a reply?',
      "What's the history of this conversation?",
      'Do I have a quick reply template for this?',
    ],
    actions: [
      'Draft a reply to this inbox thread',
      'Send a reply to this inbox thread',
      'Mark this inbox thread as read',
    ],
  },
  marketing_template: {
    questions: [
      'What marketing templates do I have?',
      "What's the publish history for this template?",
      'What caption should I use for this template?',
      'What music fits this template?',
    ],
    actions: [
      'Publish this template to Meta',
      'Draft a caption for this template',
      'Draft a new marketing template',
    ],
  },
  marketing_theme: {
    questions: [
      'What themes do I have?',
      "What's in this theme?",
      'Which theme should I use for a weekend promo?',
    ],
    actions: ['Open this theme in Marketing', 'Describe a new theme'],
  },
  review: {
    questions: [
      'What did this guest write?',
      'What is my average rating?',
      'Which reviews still need a reply?',
    ],
    actions: ['Draft a response to this review', 'Open reviews'],
  },
  voucher: {
    questions: [
      'Which vouchers are still open?',
      'Did this guest redeem their voucher?',
      'How many vouchers were used this month?',
    ],
    actions: ['Open guest rewards settings'],
  },
  notification_module: {
    questions: [
      'Explain notifications for this module',
      'What are my current notification preferences?',
      'Explain Telegram alerts for this module',
    ],
    actions: [
      'Set up notifications for this module',
      'Set up Telegram alerts for this module',
      'Mute this module',
    ],
  },
  public_page: {
    questions: [
      'Is this page published?',
      "What's the status of this page?",
      'What template does this page use?',
    ],
    actions: ["Update this page's template", 'Publish this page'],
  },
  ticket: {
    questions: [
      "What's the status of this ticket?",
      'What tickets are still open?',
      'What was this ticket about?',
      'Explain Help & Support tickets',
    ],
    actions: ['Create a support ticket', 'Follow up on this ticket'],
  },
  property_template: {
    questions: [
      'What does this template say?',
      'Where is this template used?',
      'Can I shorten this template?',
    ],
    actions: [
      'Rewrite this template for a late checkout',
      'Draft a guest message from this template',
    ],
  },
};

function toSuggestions(
  type: AttachedContextType,
  kind: AssistantSuggestionKind,
  prompts: readonly string[]
): AssistantSuggestion[] {
  return prompts.map((prompt, index) => ({
    id: `mod-${type}-${kind}-${String(index + 1).padStart(2, '0')}`,
    kind,
    prompt,
  }));
}

const MODULE_SUGGESTIONS: Record<
  AttachedContextType,
  { questions: AssistantSuggestion[]; actions: AssistantSuggestion[] }
> = Object.fromEntries(
  ATTACHED_CONTEXT_TYPES.map((type) => [
    type,
    {
      questions: toSuggestions(type, 'question', MODULE_PROMPTS[type].questions),
      actions: toSuggestions(type, 'action', MODULE_PROMPTS[type].actions),
    },
  ])
) as Record<
  AttachedContextType,
  { questions: AssistantSuggestion[]; actions: AssistantSuggestion[] }
>;

/**
 * Merge ranked per-module prompts for one or more pinned module types.
 *
 * Walks rank tiers (rank 1 first) and, at each tier, takes the next prompt from every
 * pinned module in canonical module order (`ATTACHED_CONTEXT_TYPES`) — so pinning
 * Pricing + Bookings + Properties together surfaces each module's top prompt before
 * any module's second prompt, rather than favoring whichever module has the longest list.
 *
 * Returns an empty array when no types are pinned so callers can fall back to the
 * generic random pool.
 */
export function selectContextualSuggestions(
  attachedTypes: readonly AttachedContextType[],
  kind: AssistantSuggestionKind,
  count: number
): AssistantSuggestion[] {
  const uniqueTypes = new Set(attachedTypes);
  const orderedTypes = ATTACHED_CONTEXT_TYPES.filter((type) => uniqueTypes.has(type));
  if (orderedTypes.length === 0) return [];

  const lists = orderedTypes.map(
    (type) => MODULE_SUGGESTIONS[type][kind === 'question' ? 'questions' : 'actions']
  );
  const maxLen = lists.reduce((max, list) => Math.max(max, list.length), 0);

  const result: AssistantSuggestion[] = [];
  const seenPrompts = new Set<string>();
  for (let rank = 0; rank < maxLen && result.length < count; rank++) {
    for (const list of lists) {
      if (result.length >= count) break;
      const item = list[rank];
      if (item && !seenPrompts.has(item.prompt)) {
        seenPrompts.add(item.prompt);
        result.push(item);
      }
    }
  }
  return result;
}
