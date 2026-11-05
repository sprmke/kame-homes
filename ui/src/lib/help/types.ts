import type { LucideIcon } from 'lucide-react';

/** Where a hint sits: a field label, a metric/stat, or a section title. */
export type HelpHintVariant = 'field' | 'metric' | 'section';

export type HowItWorksStep = {
  icon: LucideIcon;
  /** One short line, e.g. "Pick your rates". */
  title: string;
  /** One short line, e.g. "Base and weekend rates set your normal price." */
  body: string;
};

export type HowItWorksCopy = {
  /** Panel heading, e.g. "How pricing works". */
  title: string;
  /** Three to four steps. The copy guard fails on fewer or more. */
  steps: HowItWorksStep[];
  /** Optional single tip shown under the steps. */
  tip?: string;
  /** Internal Help Center path. Omit when no article exists. */
  learnMoreHref?: string;
};

/**
 * One entry per surface in a feature's `*HelpCopy.ts` file. Keep copy here,
 * never inline in JSX, so the copy guard and the support-content sync can read it.
 */
export type HelpCopyEntry = {
  /**
   * Stable key shared with the Help Center / AI knowledge base export. Set it
   * when the entry is copied into host-facing support content.
   */
  contentKey?: string;
  hint?: string;
  howItWorks?: HowItWorksCopy;
};

/** Shape of every `*HelpCopy.ts` module. */
export type HelpCopyModule = Record<string, HelpCopyEntry>;
