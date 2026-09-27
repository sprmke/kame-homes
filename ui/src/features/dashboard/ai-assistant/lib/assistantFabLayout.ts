import type { AiDashboardAssistantOrgSettings } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

/** Desktop FAB diameter — matches `min-h` / `min-w` on launcher + notification FABs. */
export const AI_ASSISTANT_FAB_SIZE_PX = 52;

/** Vertical gap between stacked desktop FABs (notification above assistant). */
export const AI_ASSISTANT_FAB_STACK_GAP_PX = 12;

/**
 * Bottom offset for the notification FAB when the assistant FAB is also shown.
 * Keep as a **static** class string (not a template literal) so Tailwind JIT emits the utility.
 * Value = FAB size (52) + stack gap (12) = 64px above the assistant’s bottom edge.
 */
export const notificationFabStackedBottomClassName =
  'bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+64px)]';

/**
 * Matches `AiAssistantLauncherButton` mount rules — assistant FAB can show read-only when
 * plan-gated but kill-switches are on; notification offset must follow the same signal.
 */
export function isAiAssistantFabVisible(
  accessible: boolean,
  settings: AiDashboardAssistantOrgSettings | undefined,
  planGateAllowed: boolean,
  permissionAllowed = true
): boolean {
  if (!permissionAllowed) return false;
  const killSwitchOff = Boolean(settings && (!settings.platformEnabled || !settings.enabled));
  if (!accessible && (killSwitchOff || planGateAllowed)) return false;
  return true;
}
