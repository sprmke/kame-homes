/** Which AI switch is off. Mirrors `AiFeatureBlocker` (edge `aiUsageService.ts`). */
export type AssistantAiBlocker = 'platform' | 'organization' | 'property';

/** Blocks a host can lift in Settings. A platform block stays a plain error: hosts cannot undo it. */
export type AssistantAiOffReason = Exclude<AssistantAiBlocker, 'platform'>;

/**
 * Settings are refetched after a blocked turn and are authoritative for the platform and org
 * switches, so a stale org block from an earlier turn clears once AI is back on. Settings cannot
 * see a property switch, so only a turn reports that one.
 */
export function resolveAssistantAiOffReason(
  settingsBlocker: AssistantAiBlocker | null | undefined,
  turnBlocker: AssistantAiBlocker | null
): AssistantAiOffReason | null {
  const blocker =
    settingsBlocker !== undefined && turnBlocker !== 'property' ? settingsBlocker : turnBlocker;
  return blocker === 'organization' || blocker === 'property' ? blocker : null;
}
