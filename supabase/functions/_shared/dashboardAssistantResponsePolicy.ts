/**
 * Deterministic response-shape pass (Phase 2). Runs after hydration/grounding and before
 * persist so chip caps, filler openers, and empty-answer gaps cannot reach the host.
 */

import type { ChatBlock } from './dashboardAssistantSafetyGuard.ts';

const FILLER_OPENER_RE =
  /^(sure!?|of course!?|absolutely!?|happy to help!?|great question!?|certainly!?|let me (walk you through|check|look that up))[,!.]?\s+/i;

const FILLER_SENTENCE_RE =
  /^(sure|of course|absolutely|happy to help|great question|certainly|let me walk you through.{0,80}|to summarize( once more)?)[.!]?$/i;

const NUMERIC_TYPES = new Set(['stat_list', 'data_table', 'booking_card', 'kpi']);

const ANSWER_LEAD_TYPES: ReadonlySet<string> = new Set([
  'text',
  'action_confirmation',
  'callout',
  'stat_list',
  'data_table',
  'booking_card',
  'file_list',
  'stepper',
  'chart',
  'calendar',
  'timeline',
  'entity_card',
  'carousel',
  'kpi',
  'comparison',
  'checklist',
]);

const CHROME_TYPES: ReadonlySet<string> = new Set(['activity_timeline', 'task_plan']);

const MAX_CHIPS = 4;
const MAX_HEADLINE_CHARS = 240;

export function stripFillerOpener(text: string): string {
  return text.replace(FILLER_OPENER_RE, '').trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function trimHeadline(text: string, max = MAX_HEADLINE_CHARS): string {
  const sentences = splitSentences(stripFillerOpener(text)).filter(
    (sentence) => !FILLER_SENTENCE_RE.test(sentence)
  );
  const headline = sentences.slice(0, 2).join(' ').trim();
  return truncateAtWord(headline, max);
}

export function enforceResponseShape(blocks: ChatBlock[]): ChatBlock[] {
  const hasNumeric = blocks.some((block) => NUMERIC_TYPES.has(block.type));
  const next: ChatBlock[] = [];
  let sawNumeric = false;
  let keptText = false;

  for (const block of blocks) {
    if (block.type === 'text') {
      const text = trimHeadline(block.text ?? '');
      if (!text) continue;
      if (hasNumeric && keptText) continue;
      next.push({ ...block, text });
      keptText = true;
      continue;
    }
    if (block.type === 'quick_actions') {
      const actions = (block.actions ?? []).slice(0, MAX_CHIPS);
      if (actions.length === 0) continue;
      next.push({ type: 'quick_actions', actions });
      continue;
    }
    if (NUMERIC_TYPES.has(block.type)) {
      if (sawNumeric) continue;
      sawNumeric = true;
    }
    next.push(block);
  }

  const hasContent = next.some((block) => block.type !== 'quick_actions');
  if (!hasContent) {
    next.unshift({ type: 'text', text: 'Which one?' });
  }

  const lead = next.find((block) => !CHROME_TYPES.has(block.type));
  if (lead && !ANSWER_LEAD_TYPES.has(lead.type)) {
    const textIdx = next.findIndex((block) => block.type === 'text');
    if (textIdx > 0) {
      const [textBlock] = next.splice(textIdx, 1);
      next.unshift(textBlock);
    } else if (textIdx < 0) {
      next.unshift({ type: 'text', text: 'Here is what I found.' });
    }
  }

  return next;
}
