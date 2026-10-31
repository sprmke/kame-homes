import {
  blocksContainAction,
  pickMessageWithAction,
  updateActionBlockStatus,
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
