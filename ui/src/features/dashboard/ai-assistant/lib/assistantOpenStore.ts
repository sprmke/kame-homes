/**
 * Cross-component one-shot signal to open the AI assistant panel from outside
 * AdminLayoutShell (e.g. Help & Support).
 *
 * `requestId` is an incrementing event counter, not "the panel should be open".
 * Consumers must ignore the snapshot they see on mount and only react to later
 * increments — org/property/parking shells remount AdminLayout, and a leftover
 * id would otherwise reopen the panel on every tenant switch.
 */

let requestId = 0;
const listeners = new Set<() => void>();

export function openAiAssistant(): void {
  requestId += 1;
  for (const listener of listeners) listener();
}

export function subscribeAssistantOpenRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAssistantOpenRequestId(): number {
  return requestId;
}
