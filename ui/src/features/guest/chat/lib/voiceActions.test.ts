import { describe, expect, it } from 'vitest';

import { sanitizeVoiceReceptionistActions } from './voiceActions';

describe('sanitizeVoiceReceptionistActions', () => {
  it('keeps only allowlisted internal actions', () => {
    expect(
      sanitizeVoiceReceptionistActions([
        { type: 'open_calendar', label: 'Open calendar', url: '/properties/solea/calendar' },
        { type: 'open_calendar', label: 'External', url: 'https://evil.example' },
        { type: 'run_script', label: 'Bad', url: '/safe-looking' },
      ])
    ).toEqual([
      { type: 'open_calendar', label: 'Open calendar', url: '/properties/solea/calendar' },
    ]);
  });

  it('bounds labels, URLs, and action count', () => {
    const actions = sanitizeVoiceReceptionistActions(
      Array.from({ length: 5 }, (_, index) => ({
        type: 'open_property',
        label: `Property ${index} ${'x'.repeat(50)}`,
        url: `/${'a'.repeat(600)}`,
      }))
    );
    expect(actions).toHaveLength(3);
    expect(actions[0]?.label).toHaveLength(40);
    expect(actions[0]?.url).toHaveLength(500);
  });
});
