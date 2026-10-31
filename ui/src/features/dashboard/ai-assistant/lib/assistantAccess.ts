/** Whether Send / New chat should open the plan upgrade modal. */
export function shouldPromptAssistantUpgrade(input: {
  accessPending: boolean;
  permissionAllowed: boolean;
  accessible: boolean;
}): boolean {
  if (input.accessPending) return false;
  if (!input.permissionAllowed) return false;
  return !input.accessible;
}
