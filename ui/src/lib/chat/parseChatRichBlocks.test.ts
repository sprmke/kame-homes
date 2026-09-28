import { describe, expect, it } from 'vitest';

import {
  isGoogleMapsUrl,
  isMostlyLatinScript,
  normalizeChatText,
  osmStaticMapUrl,
  parseChatRichBlocks,
  parseMapsCoordinates,
  urlLinkCardMeta,
} from '@/lib/chat/parseChatRichBlocks';

describe('normalizeChatText', () => {
  it('normalizeChatText is exported', () => {
    expect(typeof normalizeChatText).toBe('function');
  });
});

describe('isMostlyLatinScript', () => {
  it('isMostlyLatinScript is exported', () => {
    expect(typeof isMostlyLatinScript).toBe('function');
  });
});

describe('isGoogleMapsUrl', () => {
  it('isGoogleMapsUrl is exported', () => {
    expect(typeof isGoogleMapsUrl).toBe('function');
  });
});

describe('parseMapsCoordinates', () => {
  it('parseMapsCoordinates is exported', () => {
    expect(typeof parseMapsCoordinates).toBe('function');
  });
});

describe('urlLinkCardMeta', () => {
  it('urlLinkCardMeta is exported', () => {
    expect(typeof urlLinkCardMeta).toBe('function');
  });
});

describe('parseChatRichBlocks', () => {
  it('parseChatRichBlocks is exported', () => {
    expect(typeof parseChatRichBlocks).toBe('function');
  });

  it('parses flow fences into a flow block', () => {
    const blocks = parseChatRichBlocks(
      '```flow\ntitle: Check-in flow\n1. Confirm booking\n2. Send guide\n```'
    );
    expect(blocks).toEqual([
      {
        type: 'flow',
        title: 'Check-in flow',
        steps: ['Confirm booking', 'Send guide'],
      },
    ]);
  });

  it('parses mermaid fences into a diagram block', () => {
    const blocks = parseChatRichBlocks('```mermaid\ngraph TD\nA[Start]-->B[Done]\n```');
    expect(blocks).toEqual([
      {
        type: 'diagram',
        format: 'mermaid',
        source: 'graph TD\nA[Start]-->B[Done]',
      },
    ]);
  });

  it('parses form fences into a form block', () => {
    const blocks = parseChatRichBlocks(
      '```form\ntitle: Missing details\n- Full name*: As on booking\n- Email (required)\n```'
    );
    expect(blocks).toEqual([
      {
        type: 'form',
        title: 'Missing details',
        fields: [
          { label: 'Full name', hint: 'As on booking', required: true },
          { label: 'Email', required: true },
        ],
      },
    ]);
  });

  it('parses table fences into a data table block', () => {
    const blocks = parseChatRichBlocks(
      '```table\ntitle: Upcoming stays\n| Guest | Check-in |\n| --- | --- |\n| Ana | 2026-09-24 |\n```'
    );
    expect(blocks).toEqual([
      {
        type: 'dataTable',
        title: 'Upcoming stays',
        columns: ['Guest', 'Check-in'],
        rows: [['Ana', '2026-09-24']],
      },
    ]);
  });

  it('keeps prose and map links around fenced blocks', () => {
    const blocks = parseChatRichBlocks(
      [
        'Summary first.',
        '```flow',
        '- Step one',
        '- Step two',
        '```',
        'Map: https://maps.google.com/?q=14.5995,120.9842',
      ].join('\n')
    );
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[1]).toEqual({
      type: 'flow',
      steps: ['Step one', 'Step two'],
    });
    expect(blocks[2]).toMatchObject({ type: 'paragraph' });
    expect(blocks[3]).toMatchObject({ type: 'mapLink' });
  });

  it('renders bold markers in paragraphs and list items', () => {
    const blocks = parseChatRichBlocks(
      'Of these, 17 are **Imported**.\n- 1 is **Pending Review**\n* 2 are *done*'
    );
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      segments: [
        { type: 'text', text: 'Of these, 17 are ' },
        { type: 'text', text: 'Imported', marks: ['bold'] },
        { type: 'text', text: '.' },
      ],
    });
    expect(blocks[1]).toEqual({
      type: 'list',
      ordered: false,
      items: [
        [
          { type: 'text', text: '1 is ' },
          { type: 'text', text: 'Pending Review', marks: ['bold'] },
        ],
        [
          { type: 'text', text: '2 are ' },
          { type: 'text', text: 'done', marks: ['italic'] },
        ],
      ],
    });
  });

  it('parses headings, quotes and dividers', () => {
    const blocks = parseChatRichBlocks(
      '## Summary\n> Guest asked for **late** check-out\n---\nDone'
    );
    expect(blocks).toEqual([
      { type: 'heading', level: 2, segments: [{ type: 'text', text: 'Summary' }] },
      {
        type: 'quote',
        segments: [
          { type: 'text', text: 'Guest asked for ' },
          { type: 'text', text: 'late', marks: ['bold'] },
          { type: 'text', text: ' check-out' },
        ],
      },
      { type: 'divider' },
      { type: 'paragraph', segments: [{ type: 'text', text: 'Done' }] },
    ]);
  });

  it('keeps hashtags as text', () => {
    expect(parseChatRichBlocks('#beachfront stay')[0]).toMatchObject({ type: 'paragraph' });
  });

  it('parses unfenced markdown tables', () => {
    const blocks = parseChatRichBlocks(
      'Here you go:\n| Guest | Status |\n| --- | --- |\n| Ana | **Imported** |\nThanks'
    );
    expect(blocks[1]).toEqual({
      type: 'dataTable',
      title: undefined,
      columns: ['Guest', 'Status'],
      rows: [['Ana', '**Imported**']],
    });
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[2]).toMatchObject({ type: 'paragraph' });
  });

  it('keeps markdown https links inline instead of a link card', () => {
    const blocks = parseChatRichBlocks('Read [the guide](https://example.com/guide) first.');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        segments: [
          { type: 'text', text: 'Read ' },
          { type: 'link', href: 'https://example.com/guide', text: 'the guide' },
          { type: 'text', text: ' first.' },
        ],
      },
    ]);
  });
});

describe('osmStaticMapUrl', () => {
  it('osmStaticMapUrl is exported', () => {
    expect(typeof osmStaticMapUrl).toBe('function');
  });
});
