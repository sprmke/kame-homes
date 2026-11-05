import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ASSISTANT_TOOL_MODULES,
  routeAssistantModules,
  selectToolDeclarations,
} from './dashboardAssistantToolRouter.ts';

const SHARED = new URL('./', import.meta.url);

async function declaredToolNames(): Promise<string[]> {
  const names = new Set<string>();
  for await (const entry of Deno.readDir(SHARED)) {
    if (!/^dashboardAssistant.*Tools\.ts$/.test(entry.name)) continue;
    const source = await Deno.readTextFile(new URL(entry.name, SHARED));
    for (const match of source.matchAll(/\bname:\s*'([a-z_]+)'/g)) names.add(match[1]);
  }
  return [...names].sort();
}

const base = { attachedTypes: [], pageContext: {}, recentToolNames: [] };

Deno.test('every declared tool has a router module, and no module entry is stale', async () => {
  const declared = await declaredToolNames();
  const missing = declared.filter((name) => !ASSISTANT_TOOL_MODULES[name]);
  assertEquals(missing, []);
  const stale = Object.keys(ASSISTANT_TOOL_MODULES).filter(
    (name) => !declared.includes(name) && name !== 'sync_booking_integrations'
  );
  assertEquals(stale, []);
});

Deno.test('routes by the host’s words and always keeps core', () => {
  const route = routeAssistantModules({ ...base, message: 'Log a 500 cleaning expense for today' });
  assert(route.modules.includes('core'));
  assert(route.modules.includes('finance'));
  assertEquals(route.failOpen, false);
  assert(
    routeAssistantModules({
      ...base,
      message: 'Block the parking on December 24',
    }).modules.includes('parking')
  );
  assert(
    routeAssistantModules({ ...base, message: 'Who checks in today?' }).modules.includes('bookings')
  );
});

Deno.test('routes template content questions and pins to settings', () => {
  const byWords = routeAssistantModules({
    ...base,
    message: 'Can you display the house rules template content here?',
  });
  assert(byWords.modules.includes('settings'));
  const byPin = routeAssistantModules({
    ...base,
    attachedTypes: ['property_template'],
    message: 'What does it say?',
  });
  assert(byPin.modules.includes('settings'));
});

Deno.test('pins, the booking page and conversation history add modules', () => {
  assert(
    routeAssistantModules({
      ...base,
      message: 'summarize this',
      attachedTypes: ['maintenance_item'],
    }).modules.includes('maintenance')
  );
  assert(
    routeAssistantModules({
      ...base,
      message: 'summarize this',
      attachedTypes: ['review'],
    }).modules.includes('bookings')
  );
  assert(
    routeAssistantModules({
      ...base,
      message: 'summarize this',
      attachedTypes: ['marketing_theme'],
    }).modules.includes('marketing')
  );
  assert(
    routeAssistantModules({
      ...base,
      message: 'what next',
      pageContext: { bookingId: 'b1' },
    }).modules.includes('bookings')
  );
  const followUp = routeAssistantModules({
    ...base,
    message: 'and the next one?',
    recentToolNames: ['list_inbox_threads'],
  });
  assert(followUp.modules.includes('inbox'));
  assertEquals(followUp.failOpen, false);
});

Deno.test('plan and handoff intents route to core alone instead of failing open', () => {
  for (const message of [
    'I want to upgrade my plan',
    'Delete this property',
    'Take me to settings',
  ]) {
    const route = routeAssistantModules({ ...base, message });
    assertEquals(route.failOpen, false, message);
  }
  assertEquals(routeAssistantModules({ ...base, message: 'Delete this property' }).modules, [
    'core',
  ]);
  // "plan" as a verb is not a billing intent: nothing matched, so the router still fails open.
  assertEquals(routeAssistantModules({ ...base, message: 'plan a surprise' }).failOpen, true);
});

Deno.test('Remove Pedro routes to team instead of failing open', () => {
  const route = routeAssistantModules({ ...base, message: 'Remove Pedro' });
  assertEquals(route.failOpen, false);
  assert(route.modules.includes('team'));
});

Deno.test('Publish this to Facebook routes to marketing', () => {
  const route = routeAssistantModules({ ...base, message: 'Publish this to Facebook' });
  assertEquals(route.failOpen, false);
  assert(route.modules.includes('marketing'));
});

Deno.test('fails open when nothing matches', () => {
  const route = routeAssistantModules({ ...base, message: 'hello there' });
  assertEquals(route.failOpen, true);
  const declarations = [{ name: 'get_finance_summary' }, { name: 'open_page' }];
  assertEquals(selectToolDeclarations(declarations, route), declarations);
});

Deno.test('selectToolDeclarations keeps routed modules, core and unknown tools', () => {
  const route = routeAssistantModules({ ...base, message: 'show my expenses' });
  const selected = selectToolDeclarations(
    [
      { name: 'get_finance_summary' },
      { name: 'list_inbox_threads' },
      { name: 'open_page' },
      { name: 'brand_new_tool' },
    ],
    route
  ).map((d) => d.name);
  assertEquals(selected, ['get_finance_summary', 'open_page', 'brand_new_tool']);
});
