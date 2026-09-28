/**
 * Composer shortcuts shared by both assistant surfaces:
 * - `/` at the start of the message opens slash commands
 * - `@name` anywhere pins a booking, property, team member, … (same catalog as the context picker)
 */

export type ComposerTrigger =
  | { kind: 'slash'; query: string; start: number; end: number }
  | { kind: 'mention'; query: string; start: number; end: number };

const MAX_TRIGGER_QUERY = 40;

/** Trigger under the caret, or null. `/` only counts as the very first token of the message. */
export function detectComposerTrigger(value: string, caret: number): ComposerTrigger | null {
  const before = value.slice(0, caret);

  const slash = /^\/([\w-]{0,40})$/.exec(before);
  if (slash) return { kind: 'slash', query: slash[1], start: 0, end: caret };

  const mention = /(?:^|\s)@([^\s@]{0,40})$/.exec(before);
  if (mention) {
    const query = mention[1];
    if (query.length > MAX_TRIGGER_QUERY) return null;
    return { kind: 'mention', query, start: caret - query.length - 1, end: caret };
  }
  return null;
}

/**
 * Removes the trigger token and returns the new value + caret. A space right after the token is
 * dropped too, so "call @ma now" becomes "call now" and "@ma" alone becomes "".
 */
export function removeTriggerToken(
  value: string,
  trigger: ComposerTrigger
): { value: string; caret: number } {
  const end = value[trigger.end] === ' ' ? trigger.end + 1 : trigger.end;
  return { value: value.slice(0, trigger.start) + value.slice(end), caret: trigger.start };
}

// ── Slash commands ────────────────────────────────────────────────────────────────────────────

export type SlashCommand =
  | { id: string; label: string; hint: string; kind: 'prompt'; prompt: string }
  | {
      id: string;
      label: string;
      hint: string;
      kind: 'action';
      action: 'new_chat' | 'toggle_mode' | 'open_memory';
    };

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'new', label: '/new', hint: 'New chat', kind: 'action', action: 'new_chat' },
  {
    id: 'review',
    label: '/review',
    hint: 'Bookings to review',
    kind: 'prompt',
    prompt: 'Which bookings are waiting for my review, and what does each one need?',
  },
  {
    id: 'today',
    label: '/today',
    hint: "Today's check-ins and check-outs",
    kind: 'prompt',
    prompt: 'Who is checking in and checking out today, and is anything missing?',
  },
  {
    id: 'balance',
    label: '/balance',
    hint: 'Unpaid guest balances',
    kind: 'prompt',
    prompt: 'Which stays still have a balance due?',
  },
  {
    id: 'finance',
    label: '/finance',
    hint: "This month's income and expenses",
    kind: 'prompt',
    prompt: "What's this month's income and expenses?",
  },
  {
    id: 'maintenance',
    label: '/maintenance',
    hint: 'Open maintenance',
    kind: 'prompt',
    prompt: 'What maintenance is still open?',
  },
  {
    id: 'inbox',
    label: '/inbox',
    hint: 'Unread guest messages',
    kind: 'prompt',
    prompt: 'Which guest conversations are unread?',
  },
  {
    id: 'mode',
    label: '/mode',
    hint: 'Switch Advanced / AI',
    kind: 'action',
    action: 'toggle_mode',
  },
  {
    id: 'memory',
    label: '/memory',
    hint: 'What the assistant remembers',
    kind: 'action',
    action: 'open_memory',
  },
  {
    id: 'help',
    label: '/help',
    hint: 'What can you do?',
    kind: 'prompt',
    prompt: 'What can you help me with on this page?',
  },
];

/** Prefix matches first, then substring matches on the id or hint. */
export function filterSlashCommands(
  query: string,
  commands: SlashCommand[] = SLASH_COMMANDS
): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  const prefix = commands.filter((command) => command.id.startsWith(needle));
  const rest = commands.filter(
    (command) =>
      !command.id.startsWith(needle) &&
      (command.id.includes(needle) || command.hint.toLowerCase().includes(needle))
  );
  return [...prefix, ...rest];
}

// ── Mentions ──────────────────────────────────────────────────────────────────────────────────

export type MentionCandidate<T> = { entry: T; label: string; keywords: string };

/** Label prefix beats word prefix beats substring; ties keep catalog order. Max `limit`. */
export function rankMentionCandidates<T>(
  candidates: Array<MentionCandidate<T>>,
  query: string,
  limit = 8
): T[] {
  const needle = query.trim().toLowerCase();
  const scored: Array<{ entry: T; score: number; index: number }> = [];
  candidates.forEach((candidate, index) => {
    const label = candidate.label.toLowerCase();
    const haystack = `${label} ${candidate.keywords.toLowerCase()}`;
    let score = -1;
    if (!needle) score = 3;
    else if (label.startsWith(needle)) score = 0;
    else if (label.split(/\s+/).some((word) => word.startsWith(needle))) score = 1;
    else if (haystack.includes(needle)) score = 2;
    if (score >= 0) scored.push({ entry: candidate.entry, score, index });
  });
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.entry);
}

/** DOM id of a suggestion option (aria-activedescendant on the composer textarea). */
export function composerSuggestionOptionId(menuId: string, index: number): string {
  return `${menuId}-opt-${index}`;
}
