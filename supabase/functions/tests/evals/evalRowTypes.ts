/** Row shapes for the AI companion golden sets (shared by offline tests and live runs). */

export type AnswerQualityRow = {
  id: string;
  message: string;
  module: string;
  /** `file.json#key` refs under fixtures/assistant/ — injected as this turn's tool results. */
  fixtures: string[];
  rubric: {
    mustCover: string[];
    mustAvoid: string[];
    maxSentences: number;
    intent: 'answer' | 'clarify' | 'refuse';
  };
};

export type GuestToolRow = {
  id: string;
  phase: 'inquiry' | 'booked' | 'active' | 'post';
  message: string;
  expectToolsAny: string[];
  expectTopicAny?: string[];
  forbidTools?: string[];
  /** When no tool is expected, the reply text must contain one of these. */
  expectTextAny?: string[];
  /** Reply must decline (no tool call, refusal language). */
  expectRefusal?: boolean;
};
