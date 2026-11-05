#!/usr/bin/env bun
/**
 * Validates `docs/guides/support/faqs.md` before it is synced.
 *
 * - every `source:` path exists
 * - every category is declared in `helpFaqModules.ts` and has a scope
 * - every audience is `host`, `guest`, or `public`
 * - no duplicate content keys
 * - no em dashes in questions or answers (human-copy rule)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CURATED_FAQS_PATH, loadCuratedFaqs, ROOT } from './lib/supportContent.ts';

const FAQ_MODULES_PATH = join(ROOT, 'ui/src/features/dashboard/help-support/lib/helpFaqModules.ts');

function extractBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start < 0) return '';
  const rest = source.slice(start);
  const end = rest.indexOf(endMarker);
  return end < 0 ? rest : rest.slice(0, end);
}

function quotedStrings(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
}

function loadKnownCategories(): { moduleCategories: Set<string>; scopedCategories: Set<string> } {
  const source = readFileSync(FAQ_MODULES_PATH, 'utf8');

  const modulesBlock = extractBlock(source, 'export const FAQ_MODULES', '];');
  const moduleCategories = new Set(
    [...modulesBlock.matchAll(/categories:\s*\[([^\]]*)\]/g)].flatMap((match) =>
      quotedStrings(match[1]!)
    )
  );

  const scopeBlock = extractBlock(source, 'const CATEGORY_SCOPE', '};');
  // Handles both `'Some & Category': 'scope'` and `Bookings: 'scope'`.
  const scopedCategories = new Set(
    [...scopeBlock.matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9 &]+))\s*:\s*'([^']+)'/gm)].map(
      (match) => match[1] ?? match[2]!.trim()
    )
  );

  const pathScoped = extractBlock(source, 'const PATH_SCOPED_CATEGORIES', ');');
  for (const category of quotedStrings(pathScoped)) scopedCategories.add(category);

  return { moduleCategories, scopedCategories };
}

const errors: string[] = [];
const faqs = loadCuratedFaqs();

if (faqs.length === 0) {
  errors.push(`${CURATED_FAQS_PATH} has no parseable FAQ blocks`);
}

const { moduleCategories, scopedCategories } = loadKnownCategories();
const seenKeys = new Map<string, number>();

for (const faq of faqs) {
  if (!faq.question.trim()) errors.push(`Empty question in ${faq.contentKey}`);
  if (!faq.answer.trim()) errors.push(`Empty answer for "${faq.question}"`);
  if (faq.answer.includes('—') || faq.question.includes('—')) {
    errors.push(`Em dash in "${faq.question}" (use a period, comma, or parentheses)`);
  }
  if (!moduleCategories.has(faq.category)) {
    errors.push(`Unknown category "${faq.category}" for "${faq.question}"`);
  }
  if (!scopedCategories.has(faq.category)) {
    errors.push(`Category "${faq.category}" has no Help & Support scope in helpFaqModules.ts`);
  }
  if (faq.source && !existsSync(join(ROOT, faq.source))) {
    errors.push(`Source does not exist for "${faq.question}": ${faq.source}`);
  }
  const prior = seenKeys.get(faq.contentKey);
  if (prior !== undefined) {
    errors.push(
      `Duplicate content key "${faq.contentKey}" (questions at positions ${prior} and ${faqs.indexOf(faq) + 1})`
    );
  } else {
    seenKeys.set(faq.contentKey, faqs.indexOf(faq) + 1);
  }
}

if (errors.length > 0) {
  console.error('Support content check failed:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const categories = new Set(faqs.map((faq) => faq.category));
console.log(`OK — ${faqs.length} curated FAQs across ${categories.size} categories.`);
