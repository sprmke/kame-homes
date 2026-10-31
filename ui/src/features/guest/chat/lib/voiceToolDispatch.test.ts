import { describe, expect, it, vi } from 'vitest';

import { dispatchVoiceToolCalls } from './voiceToolDispatch';

describe('dispatchVoiceToolCalls', () => {
  it('returns provider responses and deduplicated actions', async () => {
    const execute = vi.fn().mockResolvedValue({
      toolName: 'get_property_facts',
      spokenText: 'The pool closes at 9 PM.',
      actions: [{ type: 'open_property', label: 'Property', url: '/properties/solea' }],
    });
    const result = await dispatchVoiceToolCalls(
      'session-1',
      [
        { id: '1', name: 'get_property_facts', args: { topic: 'pool' } },
        { id: '2', name: 'get_property_facts', args: { topic: 'pool' } },
      ],
      execute
    );

    expect(result.failedCount).toBe(0);
    expect(result.actions).toHaveLength(1);
    expect(result.responses).toHaveLength(2);
    expect(result.responses[0]).toMatchObject({
      response: { result: { trust: 'server_scoped_untrusted_data' } },
    });
  });

  it('returns a bounded fallback when a tool fails', async () => {
    const result = await dispatchVoiceToolCalls(
      'session-1',
      [{ id: '1', name: 'get_my_stay' }],
      vi.fn().mockRejectedValue(new Error('failed'))
    );
    expect(result.failedCount).toBe(1);
    expect(result.actions).toEqual([]);
    expect(JSON.stringify(result.responses)).toContain("I don't have that on hand");
  });
});
