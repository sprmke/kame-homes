/**
 * Phase 7 parity guard (docs/workflow/in-progress/ai-chat-mode.md): every edge function is either
 * classified by its serve wrapper (super-admin / cron / public) or listed in the parity manifest,
 * every listed tool is really declared, and every handoff route is allowlisted.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { DASHBOARD_ASSISTANT_PARITY } from '../_shared/dashboardAssistantParity.ts';
import { ASSISTANT_ROUTES } from '../_shared/dashboardAssistantRoutes.ts';

const FUNCTIONS_DIR = new URL('../', import.meta.url);
const SELF_CLASSIFYING = /\bserve(SuperAdmin|CronPost|Public)\s*\(/;

async function functionDirs(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory || entry.name.startsWith('_') || entry.name === 'tests') continue;
    if (entry.name === 'node_modules') continue;
    try {
      await Deno.stat(new URL(`${entry.name}/index.ts`, FUNCTIONS_DIR));
      names.push(entry.name);
    } catch {
      // not a function
    }
  }
  return names.sort();
}

async function declaredToolNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const entry of Deno.readDir(new URL('_shared/', FUNCTIONS_DIR))) {
    if (!/^dashboardAssistant.*Tools\.ts$/.test(entry.name)) continue;
    const source = await Deno.readTextFile(new URL(`_shared/${entry.name}`, FUNCTIONS_DIR));
    for (const match of source.matchAll(/\bname:\s*'([a-z_]+)'/g)) names.add(match[1]);
  }
  return names;
}

Deno.test('every edge function is classified for assistant parity', async () => {
  const missing: string[] = [];
  for (const name of await functionDirs()) {
    if (Object.hasOwn(DASHBOARD_ASSISTANT_PARITY, name)) continue;
    const source = await Deno.readTextFile(new URL(`${name}/index.ts`, FUNCTIONS_DIR));
    if (!SELF_CLASSIFYING.test(source)) missing.push(name);
  }
  assertEquals(
    missing,
    [],
    `Add these to _shared/dashboardAssistantParity.ts (tool | handoff | excluded | read | …)`
  );
});

Deno.test('manifest has no stale entries', async () => {
  const dirs = new Set(await functionDirs());
  const stale = Object.keys(DASHBOARD_ASSISTANT_PARITY).filter((name) => !dirs.has(name));
  assertEquals(stale, []);
});

Deno.test('manifest tools are declared to the model', async () => {
  const declared = await declaredToolNames();
  const unknown: string[] = [];
  for (const [fn, entry] of Object.entries(DASHBOARD_ASSISTANT_PARITY)) {
    if (entry.kind !== 'tool') continue;
    assert(entry.tools.length > 0, `${fn} lists no tools`);
    for (const toolName of entry.tools) {
      if (!declared.has(toolName)) unknown.push(`${fn} → ${toolName}`);
    }
  }
  assertEquals(unknown, []);
});

Deno.test('manifest handoffs point at allowlisted routes', () => {
  for (const [fn, entry] of Object.entries(DASHBOARD_ASSISTANT_PARITY)) {
    if (entry.kind !== 'handoff' && entry.kind !== 'excluded') continue;
    assert(Object.hasOwn(ASSISTANT_ROUTES, entry.routeKey), `${fn} → ${entry.routeKey}`);
    assert(entry.reason.trim().length > 0, `${fn} needs a reason`);
  }
});

Deno.test('never-build writes stay excluded (docs §5)', () => {
  for (const fn of [
    'delete-organization',
    'delete-property',
    'copy-property-settings',
    'import-commit',
    'update-booking-details',
    'property-templates-settings',
    'marketing-templates',
    'analytics-ai-review',
  ]) {
    assertEquals(DASHBOARD_ASSISTANT_PARITY[fn]?.kind, 'excluded', fn);
  }
});

Deno.test('tool-selection eval set only names declared tools', async () => {
  const declared = await declaredToolNames();
  const source = await Deno.readTextFile(
    new URL('tests/evals/datasets/assistant_tool_selection.jsonl', FUNCTIONS_DIR)
  );
  const unknown: string[] = [];
  for (const line of source.split('\n').filter((l) => l.trim())) {
    const row = JSON.parse(line) as {
      id: string;
      expectToolsAny?: string[];
      forbidTools?: string[];
    };
    for (const name of [...(row.expectToolsAny ?? []), ...(row.forbidTools ?? [])]) {
      if (!declared.has(name)) unknown.push(`${row.id} → ${name}`);
    }
  }
  assertEquals(unknown, []);
});

Deno.test('parity tool tier registry matches the declared parity tools', async () => {
  const names = await import('../_shared/dashboardAssistantParityToolNames.ts');
  const registered = [
    ...names.PARITY_READ_TOOL_NAMES,
    ...names.PARITY_TIER1_TOOL_NAMES,
    ...names.PARITY_TIER2_TOOL_NAMES,
  ].sort();
  const source = await Deno.readTextFile(
    new URL('_shared/dashboardAssistantParityTools.ts', FUNCTIONS_DIR)
  );
  const declared = [...source.matchAll(/\bname:\s*'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assertEquals(registered, declared);
  // Every write name is a propose_* tool and every read is not.
  for (const name of names.PARITY_READ_TOOL_NAMES) assert(!name.startsWith('propose_'), name);
  // Writes are propose_*; remember_preference is the one host-requested exception.
  for (const name of [...names.PARITY_TIER1_TOOL_NAMES, ...names.PARITY_TIER2_TOOL_NAMES]) {
    assert(name.startsWith('propose_') || name === 'remember_preference', name);
  }
});
