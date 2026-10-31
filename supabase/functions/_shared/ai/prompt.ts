/**
 * Prompt registry contract. Each feature's prompt lives in `_shared/ai/prompts/<feature>.ts`
 * (or its feature module) as a versioned definition; the gateway records `id` + `version` on
 * every usage event, so a quality or cost change can be traced to the prompt edit that caused it.
 *
 * Bump `version` whenever the wording, schema or grounding of a prompt changes.
 */

export type PromptRef = {
  /** Stable id, e.g. `inbox_reply`. */
  id: string;
  /** Date-based version, e.g. `2026-09-24.1`. */
  version: string;
};

export function definePrompt<T extends PromptRef>(prompt: T): Readonly<T> {
  if (!/^[a-z0-9_]+$/.test(prompt.id)) throw new Error(`Invalid prompt id: ${prompt.id}`);
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(prompt.version)) {
    throw new Error(`Invalid prompt version for ${prompt.id}: ${prompt.version}`);
  }
  return Object.freeze(prompt);
}
