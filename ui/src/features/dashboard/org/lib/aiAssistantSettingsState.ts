import type { AssistantAiBlocker } from '@/features/dashboard/ai-assistant/lib/assistantAiOff';

/** Why the dashboard assistant cannot be used right now, from the host's point of view. */
export type AssistantSettingsLock = 'platform' | 'plan' | null;

export type AssistantSettingsState = {
  lock: AssistantSettingsLock;
  /** The org switch cannot be flipped at all (platform off, or read-only for this host). */
  toggleDisabled: boolean;
  /** Usage, per-property list, and Save only make sense when the assistant can actually run. */
  showBody: boolean;
};

/**
 * A host should never be able to switch on an assistant that the super admin (or their plan)
 * has turned off. The switch stays visible so the reason is discoverable, but it is disabled:
 * - platform: super admin kill switch, or the AI platform feature list, blocks every org.
 * - plan: the org's plan does not include the assistant. An org that already has it on may
 *   still switch it off.
 */
export function resolveAssistantSettingsState(input: {
  active: boolean;
  platformEnabled: boolean;
  aiBlocker: AssistantAiBlocker | null | undefined;
  planAllowed: boolean;
  /** False while the plan is loading or failed open; never flash a lock on unknown data. */
  planReady: boolean;
  readOnly: boolean;
}): AssistantSettingsState {
  const platformLocked = !input.platformEnabled || input.aiBlocker === 'platform';
  const planLocked = input.planReady && !input.planAllowed;
  const lock: AssistantSettingsLock = platformLocked ? 'platform' : planLocked ? 'plan' : null;

  return {
    lock,
    toggleDisabled: input.readOnly || lock === 'platform' || (lock === 'plan' && !input.active),
    showBody: input.active && lock === null,
  };
}
