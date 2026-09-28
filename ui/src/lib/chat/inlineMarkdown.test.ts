import { describe, expect, it } from 'vitest';

import {
  markdownToPlainText,
  parseInlineMarkdown,
  stripInlineMarkdown,
} from '@/lib/chat/inlineMarkdown';

describe('parseInlineMarkdown', () => {
  it('renders bold instead of literal asterisks', () => {
    expect(parseInlineMarkdown('Status is **Pending Review** now')).toEqual([
      { type: 'text', text: 'Status is ' },
      { type: 'text', text: 'Pending Review', marks: ['bold'] },
      { type: 'text', text: ' now' },
    ]);
  });

  it('parses italic, strike and code', () => {
    expect(parseInlineMarkdown('*soon* ~~old~~ `ABC-1`')).toEqual([
      { type: 'text', text: 'soon', marks: ['italic'] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'old', marks: ['strike'] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'ABC-1', marks: ['code'] },
    ]);
    expect(parseInlineMarkdown('an _important_ note')[1]).toEqual({
      type: 'text',
      text: 'important',
      marks: ['italic'],
    });
  });

  it('nests marks', () => {
    expect(parseInlineMarkdown('***Imported***')).toEqual([
      { type: 'text', text: 'Imported', marks: ['bold', 'italic'] },
    ]);
  });

  it('leaves identifiers, math and lone markers alone', () => {
    for (const text of ['booking_id and guest_name', '2*3*4', 'a * b', '5 ** 2', '**']) {
      expect(stripInlineMarkdown(text)).toBe(text);
    }
  });

  it('keeps code literal', () => {
    expect(parseInlineMarkdown('`**raw**`')).toEqual([
      { type: 'text', text: '**raw**', marks: ['code'] },
    ]);
  });

  it('turns https markdown links into links and unsafe targets into text', () => {
    expect(parseInlineMarkdown('See [**guide**](https://example.com/g).')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', href: 'https://example.com/g', text: 'guide' },
      { type: 'text', text: '.' },
    ]);
    expect(stripInlineMarkdown('[Bookings](/org/acme/bookings) and [x](javascript:void)')).toBe(
      'Bookings and x'
    );
  });
});

describe('markdownToPlainText', () => {
  it('drops heading, quote and inline markers', () => {
    expect(markdownToPlainText('## Summary\n> **3** new\n- *one*')).toBe('Summary\n3 new\n- one');
  });
});
