import {
  blocksContainAction,
  blocksContainPlan,
  pickMessageWithAction,
  pickMessageWithPlan,
  updateActionBlockStatus,
  updateActionPlanBlock,
} from './dashboardAssistantConfirmBlocks.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('pickMessageWithAction prefers the assistant turn that holds the card', () => {
  const actionId = 'act-1';
  const user = {
    id: 'user-msg',
    blocks: [{ type: 'text', text: 'Mark the leaking faucet done' }],
  };
  const assistant = {
    id: 'asst-msg',
    blocks: [
      { type: 'activity_timeline', entries: [] },
      {
        type: 'action_confirmation',
        actionId,
        status: 'proposed',
        summary: 'Mark Leaking faucet done.',
      },
    ],
  };
  assert(blocksContainAction(user.blocks, actionId) === false, 'user has no card');
  assert(pickMessageWithAction([user, assistant], actionId)?.id === 'asst-msg', 'assistant');
  const patched = updateActionBlockStatus(assistant.blocks, actionId, 'executed', null, 'Done.');
  assert(Array.isArray(patched), 'array');
  const card = patched.find(
    (block) =>
      block &&
      typeof block === 'object' &&
      (block as { type?: string }).type === 'action_confirmation'
  ) as { status?: string; resultNote?: string };
  assert(card.status === 'executed', 'executed');
  assert(card.resultNote === 'Done.', 'note');
});

Deno.test('pickMessageWithPlan finds the assistant turn holding the plan card', () => {
  const planId = 'plan-1';
  const user = { id: 'user-msg', blocks: [{ type: 'text', text: 'Cancel A and block B' }] };
  const assistant = {
    id: 'asst-msg',
    blocks: [
      {
        type: 'action_plan',
        planId,
        status: 'proposed',
        steps: [
          { stepId: 's1', stepIndex: 0, toolName: 'propose_cancel_booking', status: 'proposed' },
          {
            stepId: 's2',
            stepIndex: 1,
            toolName: 'propose_block_property_dates',
            status: 'proposed',
          },
        ],
      },
    ],
  };
  assert(blocksContainPlan(user.blocks, planId) === false, 'user has no plan');
  assert(pickMessageWithPlan([user, assistant], planId)?.id === 'asst-msg', 'assistant');
});

Deno.test('updateActionPlanBlock patches plan status and each listed step independently', () => {
  const planId = 'plan-2';
  const blocks = [
    {
      type: 'action_plan',
      planId,
      status: 'proposed',
      steps: [
        { stepId: 's1', stepIndex: 0, toolName: 'propose_cancel_booking', status: 'proposed' },
        {
          stepId: 's2',
          stepIndex: 1,
          toolName: 'propose_block_property_dates',
          status: 'proposed',
        },
      ],
    },
  ];
  const patched = updateActionPlanBlock(blocks, planId, {
    status: 'partially_failed',
    steps: [
      { stepId: 's1', status: 'executed' },
      { stepId: 's2', status: 'failed', errorMessage: 'Dates already blocked' },
    ],
  });
  assert(Array.isArray(patched), 'array');
  const card = (patched as Array<Record<string, unknown>>)[0] as {
    status: string;
    steps: Array<{ stepId: string; status: string; errorMessage?: string }>;
  };
  assert(card.status === 'partially_failed', 'plan status patched');
  assert(card.steps[0].status === 'executed', 'step 1 executed');
  assert(card.steps[1].status === 'failed', 'step 2 failed');
  assert(typeof card.steps[1].errorMessage === 'string', 'step 2 has an error message');
});

Deno.test('updateActionPlanBlock leaves other block types untouched', () => {
  const planId = 'plan-3';
  const otherBlock = { type: 'text', text: 'unrelated' };
  const patched = updateActionPlanBlock([otherBlock], planId, { status: 'completed', steps: [] });
  assert(Array.isArray(patched), 'array');
  assert((patched as unknown[])[0] === otherBlock, 'unrelated block is the same reference');
});
