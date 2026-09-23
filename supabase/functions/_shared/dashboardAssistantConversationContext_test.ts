import {
  assistantBlocksToSnippet,
  buildConversationSummary,
  conversationContextPromptSection,
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
