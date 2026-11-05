/**
 * When the dashboard assistant may skip the LLM safety reviewer.
 *
 * Default is still the model-assisted guard. Skip it only when every signal below is clean:
 * no untrusted guest text was read, no writes or proposals this turn, grounding held, the
 * quick regex scan passed, and the answer does not introduce a URL/email/number that is not
 * already in the grounding text. Fail closed: any doubt runs the LLM.
 */

export type GuardPolicyInput = {
  untrustedContentRead: boolean;
  hasProposal: boolean;
  hasDeferredWrites: boolean;
  hasExecutedWrites: boolean;
  quickScanFailed: boolean;
  groundingRejected: boolean;
  /** Combined host-visible text of the candidate blocks. */
  answerText: string;
  groundingText: string;
};

const URL_RE = /https?:\/\/[^\s)]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_NUMBER_RE = /\d[\d,]{2,}(?:\.\d+)?/g;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[,\s]/g, '');
}

function hasLeak(answer: string, grounding: string, pattern: RegExp): boolean {
  const haystack = normalize(grounding);
  const matches = answer.match(pattern) ?? [];
  for (const match of matches) {
    if (!haystack.includes(normalize(match))) return true;
  }
  return false;
}

export function shouldRunLlmGuard(input: GuardPolicyInput): boolean {
  if (input.untrustedContentRead) return true;
  if (input.hasProposal) return true;
  if (input.hasDeferredWrites) return true;
  if (input.hasExecutedWrites) return true;
  if (input.quickScanFailed) return true;
  if (input.groundingRejected) return true;
  if (hasLeak(input.answerText, input.groundingText, URL_RE)) return true;
  if (hasLeak(input.answerText, input.groundingText, EMAIL_RE)) return true;
  if (hasLeak(input.answerText, input.groundingText, LONG_NUMBER_RE)) return true;
  return false;
}
