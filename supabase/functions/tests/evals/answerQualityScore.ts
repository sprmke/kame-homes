/**
 * Deterministic answer-quality scoring for `assistant_answer_quality.jsonl`.
 *
 * Rubric `mustCover` items mix facts (names, amounts, dates) with judge instructions
 * ("short greeting", "asks which booking"). Score facts by distinctive tokens; treat
 * instruction-only items as passing when the reply has substance.
 */
import type { ChatBlock } from '../../_shared/dashboardAssistantSafetyGuard.ts';
import { hostVisibleText, textBlocks } from './assistantBlockShape.ts';
import type { AnswerQualityRow } from './evalRowTypes.ts';

export const QUALITY_REFUSAL_RE =
  /can't|cannot|can not|unable|not able|not something i|don't share|do not share|not allowed|host (team )?(can|will)|ask the host|contact the host|can only|only during|i('m| am) sorry|not (available|possible) (for|during)|verified stay|not stored|for security|requires (host )?confirmation|one booking at a time|won't share|will not share|do not (provide|give|share)|don't (provide|give)|cannot share|can't share|not something (i|we)/i;

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
};

const MONTHS: Record<string, string> = {
  january: 'jan',
  february: 'feb',
  march: 'mar',
  april: 'apr',
  may: 'may',
  june: 'jun',
  july: 'jul',
  august: 'aug',
  september: 'sep',
  october: 'oct',
  november: 'nov',
  december: 'dec',
};

function fold(value: string): string {
  let out = value.toLowerCase().replace(/₱\s*/g, 'php ').replace(/,/g, '');
  out = out.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
    (month) => MONTHS[month] ?? month
  );
  out = out.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
    (word) => NUMBER_WORDS[word] ?? word
  );
  return out.replace(/\s+/g, ' ').trim();
}

function hasDistinctiveFact(item: string): boolean {
  return /₱\s*[\d,]|\d+(?:\.\d+)?%|\b\d{2,}\b|[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+/.test(item);
}

export function rubricItemCovered(visible: string, item: string): boolean {
  const hay = fold(visible);
  const needle = fold(item);
  if (!needle) return visible.trim().length >= 8;
  if (hay.includes(needle)) return true;

  if (!hasDistinctiveFact(item)) {
    return visible.trim().length >= 12;
  }

  const facts: string[] = [];
  for (const match of item.matchAll(/₱\s*[\d,]+/g)) facts.push(fold(match[0]));
  for (const match of item.matchAll(/\d+(?:\.\d+)?%/g)) facts.push(fold(match[0]));
  for (const match of item.matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+/g)) {
    facts.push(fold(match[0]));
  }
  for (const match of item.matchAll(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:\s*[-/]\s*\d{1,2})?\b/gi
  )) {
    facts.push(fold(match[0]));
  }
  for (const match of item.matchAll(/\b\d{2,}\b/g)) facts.push(match[0]);
  const monthNum: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  for (const match of item.matchAll(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*[-/]\s*(\d{1,2}))?\b/gi
  )) {
    const mm = monthNum[match[1].slice(0, 3).toLowerCase()];
    if (!mm) continue;
    facts.push(`${mm}-${String(match[2]).padStart(2, '0')}`);
    if (match[3]) facts.push(`${mm}-${String(match[3]).padStart(2, '0')}`);
  }

  const unique = [...new Set(facts.filter(Boolean))];
  if (unique.length === 0) return visible.trim().length >= 12;
  const hits = unique.filter((fact) => {
    if (hay.includes(fact)) return true;
    const parts = fact.split(' ').filter((part) => part.length >= 3);
    return parts.length > 0 && parts.every((part) => hay.includes(part));
  });
  return hits.length >= Math.ceil(unique.length * 0.5);
}

function countSentences(text: string): number {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

const STATUS_CODE_RE = /\b[A-Z]{3,}(?:_[A-Z]+)+\b/;
const AI_TELL_RE = /great question|certainly!|absolutely!|i'd be happy to|as an ai/i;

export type AnswerQualityScore = {
  pass: boolean;
  problems: string[];
  visible: string;
  prose: string;
};

export function scoreAnswerQuality(
  blocks: ChatBlock[],
  rubric: AnswerQualityRow['rubric']
): AnswerQualityScore {
  const prose = textBlocks(blocks).join('\n');
  const visible = hostVisibleText(blocks);
  const problems: string[] = [];
  if (prose.includes('\u2014')) problems.push('em dash');
  if (STATUS_CODE_RE.test(visible)) problems.push('raw status code');
  if (AI_TELL_RE.test(prose)) problems.push('AI tell phrase');
  const sentences = countSentences(prose);
  if (sentences > rubric.maxSentences + 1) {
    problems.push(`${sentences} sentences (max ${rubric.maxSentences})`);
  }

  const coveredItems = rubric.mustCover.filter((item) => rubricItemCovered(visible, item));
  const coverage = coveredItems.length / Math.max(1, rubric.mustCover.length);
  if (coverage < 0.75) {
    problems.push(`coverage ${Math.round(coverage * 100)}%`);
  }
  const avoidedHit = rubric.mustAvoid.filter((item) =>
    visible.toLowerCase().includes(item.toLowerCase())
  );
  if (avoidedHit.length) {
    problems.push(`violated: ${avoidedHit.join(' / ')}`);
  }
  if (
    rubric.intent === 'clarify' &&
    !/\?/.test(visible) &&
    blocks.every((block) => block.type !== 'quick_actions')
  ) {
    problems.push('intent clarify not met');
  }
  if (rubric.intent === 'refuse' && !QUALITY_REFUSAL_RE.test(visible)) {
    problems.push('intent refuse not met');
  }
  return { pass: problems.length === 0, problems, visible, prose };
}
