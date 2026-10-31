#!/usr/bin/env bun
/**
 * Local plan-gate probe for property QA (Playwright CLI must already be open + authed).
 * Usage: bun scripts/dev/qa-probe-plan-gates.mjs <tierLabel>
 */
import { $ } from 'bun';

const tier = process.argv[2] || 'unknown';
const base = 'http://localhost:5173/org/kame-home/property/monaco-2612';
const paths = [
  'pricing',
  'marketing',
  'public-pages',
  'inbox',
  'templates',
  'notifications',
  'team',
  'finance',
  'settings',
];

async function evalOnPage(js) {
  const out = await $`bun x playwright-cli eval ${js}`.nothrow().text();
  const m = out.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!m) return { error: 'no_result', snippet: out.slice(-400) };
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return { raw: m[1].trim() };
  }
}

const results = { tier, pages: [] };

for (const path of paths) {
  await $`bun x playwright-cli goto ${`${base}/${path}`}`.nothrow().quiet();
  await Bun.sleep(2200);
  const data = await evalOnPage(`(() => {
    const t = document.body.innerText.replace(/\\s+/g,' ').trim();
    const hits = [];
    for (const re of [
      /Upgrade to [^.]{0,50}/i,
      /available on [^.]{0,60}/i,
      /View plans/i,
      /Channel sync/i,
      /Publish/i,
      /Connect Meta|Connect Facebook|Telegram/i,
      /Add custom/i,
      /Autosave/i,
      /Business/i,
      /Pro and above|on Pro/i,
      /Starter/i,
    ]) {
      const m = t.match(re);
      if (m) hits.push(m[0]);
    }
    return {
      path: ${JSON.stringify(path)},
      title: document.title,
      hits: [...new Set(hits)].slice(0, 14),
      len: t.length,
    };
  })()`);
  results.pages.push(data);
  console.log(JSON.stringify(data));
}

const outPath = `/tmp/qa-gates-${tier}.json`;
await Bun.write(outPath, JSON.stringify(results, null, 2));
console.log(`WROTE ${outPath}`);
