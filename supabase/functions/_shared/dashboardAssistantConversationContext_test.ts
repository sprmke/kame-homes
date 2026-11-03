import {
  assistantBlocksToSnippet,
  buildConversationSummary,
  collectKnownFacts,
  conversationContextPromptSection,
  openPlanStepsFromLastAssistantMessage,
  priorMessagesToGeminiHistory,
  type ConversationMessageRow,
} from './dashboardAssistantConversationContext.ts';

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

Deno.test('buildConversationSummary keeps host and assistant turns', () => {
  const messages: ConversationMessageRow[] = [
    { id: '1', role: 'user', content_text: 'Show Jane bookings' },
    {
      id: '2',
      role: 'assistant',
      content_text: null,
      blocks: [
        { type: 'text', text: 'Found two stays for Jane.' },
        {
          type: 'quick_actions',
          actions: [{ label: 'Jane · Aug 19–Aug 20 · Pending Review', prompt: 'x' }],
        },
      ],
    },
    { id: '3', role: 'user', content_text: 'Jane · Aug 19–Aug 20 · Pending Review' },
  ];
  const summary = buildConversationSummary(messages);
  assertEqual(summary.includes('Host: Show Jane bookings'), true, 'user line');
  assertEqual(summary.includes('Assistant: Found two stays for Jane.'), true, 'assistant line');
  assertEqual(summary.includes('Jane · Aug 19–Aug 20'), true, 'chip context');
});

Deno.test('priorMessagesToGeminiHistory starts with user and merges same roles', () => {
  const history = priorMessagesToGeminiHistory([
    { id: 'a', role: 'assistant', content_text: 'orphan' },
    { id: 'b', role: 'user', content_text: 'first' },
    { id: 'c', role: 'user', content_text: 'second' },
    { id: 'd', role: 'assistant', content_text: 'reply' },
  ]);
  assertEqual(history[0]?.role, 'user', 'starts with user');
  assertEqual(
    history[0] && 'text' in history[0].parts[0] ? history[0].parts[0].text : '',
    'first\nsecond',
    'merged consecutive users'
  );
  assertEqual(history[1]?.role, 'model', 'model turn');
});

Deno.test('assistantBlocksToSnippet prefers text then titles', () => {
  const snippet = assistantBlocksToSnippet([
    { type: 'stat_list', title: 'This month' },
    { type: 'text', text: 'Net profit is ₱12,000.' },
  ]);
  assertEqual(snippet.includes('This month'), true, 'title');
  assertEqual(snippet.includes('Net profit'), true, 'text');
});

Deno.test('assistantBlocksToSnippet includes flow diagram and map context', () => {
  const snippet = assistantBlocksToSnippet([
    { type: 'flow', title: 'Check-in flow', steps: ['Confirm guest', 'Send guide'] },
    { type: 'diagram', format: 'mermaid', source: 'graph TD;A-->B' },
    {
      type: 'map',
      href: 'https://maps.google.com/?q=14.5995,120.9842',
      lat: 14.5995,
      lng: 120.9842,
      label: 'Makati',
    },
  ]);
  assertEqual(snippet.includes('Check-in flow'), true, 'flow title');
  assertEqual(snippet.includes('Shared a diagram'), true, 'diagram fallback summary');
  assertEqual(snippet.includes('Location: Makati'), true, 'map label');
});

Deno.test('conversationContextPromptSection empty when no summary', () => {
  assertEqual(conversationContextPromptSection(''), '', 'empty');
  assertEqual(
    conversationContextPromptSection('Host: hi').includes('Conversation so far'),
    true,
    'section header'
  );
});

Deno.test('collectKnownFacts flattens entity_refs across recent turns, freshest wins', () => {
  const messages: ConversationMessageRow[] = [
    {
      id: '1',
      role: 'assistant',
      content_text: null,
      entity_refs: [{ kind: 'booking', id: 'b1', label: 'Juan (first mention)' }],
    },
    {
      id: '2',
      role: 'assistant',
      content_text: null,
      entity_refs: [{ kind: 'booking', id: 'b1', label: 'Juan (later mention)' }],
    },
  ];
  const facts = collectKnownFacts(messages);
  assertEqual(facts.length, 1, 'one entity after dedupe');
  assertEqual(facts[0]?.label, 'Juan (later mention)', 'freshest mention wins');
});

Deno.test('collectKnownFacts with no entity_refs anywhere returns []', () => {
  const messages: ConversationMessageRow[] = [
    { id: '1', role: 'user', content_text: 'hi' },
    { id: '2', role: 'assistant', content_text: 'hello' },
  ];
  assertEqual(collectKnownFacts(messages).length, 0, 'empty');
});

Deno.test(
  'openPlanStepsFromLastAssistantMessage returns steps when the last turn left work open',
  () => {
    const messages: ConversationMessageRow[] = [
      { id: '1', role: 'user', content_text: 'do two things' },
      {
        id: '2',
        role: 'assistant',
        content_text: 'I gathered part of that.',
        blocks: [
          { type: 'text', text: 'I gathered part of that.' },
          {
            type: 'task_plan',
            title: 'Working on your request',
            steps: [
              { id: 'g0', label: 'First', status: 'done' },
              { id: 'g1', label: 'Second', status: 'pending' },
            ],
          },
        ],
      },
    ];
    const steps = openPlanStepsFromLastAssistantMessage(messages);
    assertEqual(steps?.length, 2, 'both steps carried');
    assertEqual(steps?.[0]?.status, 'done', 'done step stays done');
    assertEqual(steps?.[1]?.status, 'pending', 'open step stays pending');
  }
);

Deno.test(
  'openPlanStepsFromLastAssistantMessage returns null when the last plan fully completed',
  () => {
    const messages: ConversationMessageRow[] = [
      {
        id: '1',
        role: 'assistant',
        content_text: 'Done.',
        blocks: [
          {
            type: 'task_plan',
            title: 'Working on your request',
            steps: [
              { id: 'g0', label: 'First', status: 'done' },
              { id: 'g1', label: 'Second', status: 'done' },
            ],
          },
        ],
      },
    ];
    assertEqual(openPlanStepsFromLastAssistantMessage(messages), null, 'nothing to resume');
  }
);

Deno.test(
  'openPlanStepsFromLastAssistantMessage returns null when the last assistant turn has no plan block',
  () => {
    const messages: ConversationMessageRow[] = [
      {
        id: '1',
        role: 'assistant',
        content_text: 'Sure, done.',
        blocks: [{ type: 'text', text: 'Sure, done.' }],
      },
    ];
    assertEqual(openPlanStepsFromLastAssistantMessage(messages), null, 'no plan block');
  }
);

Deno.test(
  'openPlanStepsFromLastAssistantMessage only looks at the most recent assistant turn',
  () => {
    const messages: ConversationMessageRow[] = [
      {
        id: '1',
        role: 'assistant',
        content_text: 'Still working.',
        blocks: [
          {
            type: 'task_plan',
            title: 'Working on your request',
            steps: [{ id: 'g0', label: 'Older open step', status: 'pending' }],
          },
        ],
      },
      { id: '2', role: 'user', content_text: 'thanks' },
      {
        id: '3',
        role: 'assistant',
        content_text: 'You are welcome.',
        blocks: [{ type: 'text', text: 'ok' }],
      },
    ];
    assertEqual(
      openPlanStepsFromLastAssistantMessage(messages),
      null,
      'the latest assistant turn has no plan, the older one does not count'
    );
  }
);
