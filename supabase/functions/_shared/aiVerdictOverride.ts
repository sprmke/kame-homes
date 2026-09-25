/**
 * AI document checks are advisory (docs/architecture/ai-platform.md): an AI `invalid` receipt
 * verdict blocks a workflow transition by default, but a person can explicitly proceed. Automation
 * (crons, webhooks) and the AI assistant can never override an AI verdict.
 */

import type { ActivityActorType, ActorContext } from './activityLog.ts';
import { EdgeError } from './httpResponse.ts';
import { receiptVerdictBlocksAdminTransition } from './receiptValidationService.ts';

/** Actors allowed to proceed past an AI document verdict: people, never automation or the AI. */
const AI_VERDICT_OVERRIDE_ACTORS = new Set<ActivityActorType>(['org_owner', 'team_member', 'super_admin']);

/**
 * AI document checks are advisory: an `invalid` verdict blocks the transition by default, but a
 * host can explicitly proceed (`override_ai_verdict`). Returns true when an override was applied.
 * Throws a coded 409 (`ai_verdict_blocked`) so the UI can offer "Proceed anyway".
 */
export function assertAiVerdictAllowsProceed(options: {
  verdict: unknown;
  payload: { override_ai_verdict?: boolean };
  actor?: ActorContext;
  message: string;
}): boolean {
  const verdict = typeof options.verdict === 'string' ? options.verdict : null;
  if (!receiptVerdictBlocksAdminTransition(verdict)) return false;
  if (
    options.payload.override_ai_verdict === true &&
    options.actor &&
    AI_VERDICT_OVERRIDE_ACTORS.has(options.actor.actorType)
  ) {
    return true;
  }
  throw new EdgeError(409, options.message, 'ai_verdict_blocked');
}

