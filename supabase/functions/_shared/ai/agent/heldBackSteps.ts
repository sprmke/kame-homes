/**
 * Blocks that tell the host about steps the assistant prepared but did not apply.
 *
 * A turn that ends with a confirmation card used to drop everything else it had queued: extra
 * proposals were overwritten and queued low-risk writes never committed. Until plan cards
 * exist, those steps are listed here so nothing disappears silently.
 */

export const HELD_BACK_CONTINUE_ACTION = {
  label: 'Continue with the rest',
  prompt: 'Continue with the other steps you held back.',
} as const;

const MAX_LISTED = 6;

type HeldBackBlock =
  | { type: 'text'; text: string }
  | { type: 'quick_actions'; actions: Array<{ label: string; prompt: string }> };

function clean(line: string): string {
  return line.replace(/\s+/g, ' ').replace(/…+$/, '').trim();
}

export function buildHeldBackBlocks(input: {
  /** Summaries of extra Tier-2 proposals that did not get their own card. */
  proposalSummaries: readonly string[];
  /** Labels of Tier-1 writes that were queued but not applied because a card is pending. */
  queuedWriteLabels: readonly string[];
}): HeldBackBlock[] {
  const lines = [...input.proposalSummaries, ...input.queuedWriteLabels]
    .map(clean)
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const shown = lines.slice(0, MAX_LISTED);
  const more = lines.length - shown.length;
  const list = shown.map((line) => `- ${line}`).join('\n');
  const tail = more > 0 ? `\n- and ${more} more` : '';
  const noun = lines.length === 1 ? 'step' : 'steps';
  return [
    {
      type: 'text',
      text: `Review the action above first. I held back ${lines.length} other ${noun}, nothing has been applied for ${lines.length === 1 ? 'it' : 'them'}:\n${list}${tail}`,
    },
    { type: 'quick_actions', actions: [{ ...HELD_BACK_CONTINUE_ACTION }] },
  ];
}
