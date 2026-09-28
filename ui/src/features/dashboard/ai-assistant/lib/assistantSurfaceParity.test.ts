/**
 * Two surfaces, one core (docs/workflow/in-progress/ai-chat-mode.md §3a). Vitest runs in Node
 * without a DOM, so this checks the source contract: both containers render the shared pieces and
 * neither owns chat state or behavior itself.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENTS = path.resolve(__dirname, '../components');
const read = (relative: string) => readFileSync(path.join(COMPONENTS, relative), 'utf8');

const SHEET = read('AiAssistantPanel.tsx');
const FULL = read('full-page/AiModeChrome.tsx');

const SHARED_CORE = [
  'ChatThread',
  'SessionChatComposer',
  'AssistantStatusNotices',
  'ConversationHistoryList',
  'ChatCanvasOverlay',
];

describe('assistant surface parity', () => {
  it.each(SHARED_CORE)('both surfaces render the shared %s', (component) => {
    expect(SHEET).toContain(`<${component}`);
    expect(FULL).toContain(`<${component}`);
  });

  it('neither surface owns chat state (the session provider does)', () => {
    for (const source of [SHEET, FULL]) {
      expect(source).not.toMatch(/\buseAiAssistantChat\s*\(/);
      expect(source).not.toMatch(/\bstreamChatMessage\s*\(/);
      expect(source).toContain('useAiAssistantSession');
    }
  });

  it('each surface declares its surface context', () => {
    expect(SHEET).toMatch(/surface:\s*'sheet'/);
    expect(FULL).toMatch(/surface:\s*'full'/);
  });

  it('shared pieces read the session, not props drilled per surface', () => {
    for (const file of [
      'ChatThread.tsx',
      'SessionChatComposer.tsx',
      'AssistantStatusNotices.tsx',
    ]) {
      expect(read(file)).toContain('useAiAssistantSession()');
    }
  });

  it('only the session provider calls the chat hook', () => {
    expect(read('AiAssistantSessionProvider.tsx')).toMatch(/useAiAssistantChat\(pageContext\)/);
  });
});
