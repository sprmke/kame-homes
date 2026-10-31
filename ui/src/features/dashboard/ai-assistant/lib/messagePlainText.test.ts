import { describe, expect, it } from 'vitest';

import { assistantBlocksToPlainText } from '@/features/dashboard/ai-assistant/lib/messagePlainText';

describe('assistantBlocksToPlainText', () => {
  it('joins text, stats and tables and drops progress chrome', () => {
    const text = assistantBlocksToPlainText([
      { type: 'activity_timeline', entries: [] },
      { type: 'text', text: 'Two bookings need review.' },
      {
        type: 'stat_list',
        title: 'Today',
        items: [{ label: 'Check-ins', value: '2' }],
      },
      {
        type: 'data_table',
        title: 'Bookings',
        columns: ['Guest', 'Status'],
        rows: [{ Guest: 'Ana', Status: 'Pending review' }],
      },
      { type: 'quick_actions', actions: [{ label: 'Open', prompt: 'x' }] },
    ]);
    expect(text).toBe(
      'Two bookings need review.\n\nToday\n- Check-ins: 2\n\nBookings\nGuest\tStatus\nAna\tPending review'
    );
  });

  it('returns an empty string when nothing is copyable', () => {
    expect(assistantBlocksToPlainText([{ type: 'task_plan', title: 'x', steps: [] }])).toBe('');
  });
});
