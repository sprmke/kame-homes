import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { PLAN_TASK_DECLARATION, PLAN_TASK_NAME } from './taskPlanTool.ts';

Deno.test('PLAN_TASK_DECLARATION — name matches the exported constant', () => {
  assertEquals(PLAN_TASK_DECLARATION.name, PLAN_TASK_NAME);
  assertEquals(PLAN_TASK_NAME, 'plan_task');
});

Deno.test('PLAN_TASK_DECLARATION — goals parameter is a required array of strings', () => {
  const params = PLAN_TASK_DECLARATION.parameters as {
    type: string;
    properties: { goals: { type: string; items: { type: string } } };
    required: string[];
  };
  assertEquals(params.type, 'object');
  assertEquals(params.required, ['goals']);
  assertEquals(params.properties.goals.type, 'array');
  assertEquals(params.properties.goals.items.type, 'string');
});

Deno.test(
  'PLAN_TASK_DECLARATION — description documents the 2+ asks trigger and the 2-6 goal bound',
  () => {
    assert(PLAN_TASK_DECLARATION.description.includes('2 or more distinct asks'));
    const goalsDescription = (
      PLAN_TASK_DECLARATION.parameters.properties as { goals: { description: string } }
    ).goals.description;
    assert(goalsDescription.includes('2-6'), 'goals description should state the 2-6 bound');
  }
);

Deno.test(
  'PLAN_TASK_DECLARATION — never declares a handler-shaped field (pure meta-tool, nothing to execute)',
  () => {
    assertEquals(Object.keys(PLAN_TASK_DECLARATION).sort(), ['description', 'name', 'parameters']);
  }
);
