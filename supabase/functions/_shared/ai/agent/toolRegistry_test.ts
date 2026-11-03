import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { REQUEST_TOOLS_DECLARATION, widenToolsForModules } from './toolRegistry.ts';
import { ASSISTANT_TOOL_MODULES } from '../../dashboardAssistantToolRouter.ts';
import type { ToolDeclaration } from '../llmTools.ts';

function declFor(name: string): ToolDeclaration {
  return { name, description: name, parameters: { type: 'object', properties: {} } };
}

const ALL_DECLARATIONS: ToolDeclaration[] = Object.keys(ASSISTANT_TOOL_MODULES).map(declFor);

Deno.test('widenToolsForModules — adds every tool for a requested module not already held', () => {
  const current = [declFor('search_knowledge_base')];
  const outcome = widenToolsForModules(current, ALL_DECLARATIONS, ['pricing']);
  assertEquals(outcome.addedModules, ['pricing']);
  assertEquals(outcome.unknownModules, []);
  assertEquals(outcome.alreadyHadAll, false);
  const addedNames = outcome.tools.map((t) => t.name);
  assert(addedNames.includes('get_property_pricing'));
  assert(addedNames.includes('search_knowledge_base'), 'keeps what it already had');
});

Deno.test('widenToolsForModules — never duplicates a tool already in the current set', () => {
  const current = ALL_DECLARATIONS.filter((d) => ASSISTANT_TOOL_MODULES[d.name] === 'pricing');
  const outcome = widenToolsForModules(current, ALL_DECLARATIONS, ['pricing']);
  assertEquals(outcome.alreadyHadAll, true);
  assertEquals(outcome.tools.length, current.length);
});

Deno.test(
  'widenToolsForModules — reports an unknown module instead of silently dropping it',
  () => {
    const outcome = widenToolsForModules([], ALL_DECLARATIONS, ['not_a_real_module']);
    assertEquals(outcome.addedModules, []);
    assertEquals(outcome.unknownModules, ['not_a_real_module']);
    assertEquals(outcome.tools.length, 0);
  }
);

Deno.test(
  'widenToolsForModules — a mix of known and unknown modules only widens the known one',
  () => {
    const outcome = widenToolsForModules([], ALL_DECLARATIONS, ['finance', 'nonsense']);
    assertEquals(outcome.addedModules, ['finance']);
    assertEquals(outcome.unknownModules, ['nonsense']);
    assert(outcome.tools.length > 0);
    assert(outcome.tools.every((t) => ASSISTANT_TOOL_MODULES[t.name] === 'finance'));
  }
);

Deno.test('widenToolsForModules — requesting two modules at once adds both', () => {
  const outcome = widenToolsForModules([], ALL_DECLARATIONS, ['finance', 'maintenance']);
  const modulesSeen = new Set(outcome.tools.map((t) => ASSISTANT_TOOL_MODULES[t.name]));
  assertEquals(modulesSeen.size, 2);
  assert(modulesSeen.has('finance'));
  assert(modulesSeen.has('maintenance'));
});

Deno.test('REQUEST_TOOLS_DECLARATION — every module in its enum is a real routed module', () => {
  const enumValues = (
    REQUEST_TOOLS_DECLARATION.parameters.properties as {
      modules: { items: { enum: string[] } };
    }
  ).modules.items.enum;
  const realModules = new Set(Object.values(ASSISTANT_TOOL_MODULES));
  for (const value of enumValues) {
    assert(realModules.has(value as never), `${value} is not a real module`);
  }
  assertEquals(new Set(enumValues).size, enumValues.length, 'no duplicate module in the enum');
});
