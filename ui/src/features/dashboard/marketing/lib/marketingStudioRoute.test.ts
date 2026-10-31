import { describe, expect, it } from 'vitest';

import {
  applyOpenItem,
  applyStartAiSession,
  applyStartDraft,
  cameFromLibrary,
  clearItemParams,
  formatTemplateRef,
  parseTemplateRef,
  readAiOutput,
  readItemState,
  templateRefEquals,
} from '@/features/dashboard/marketing/lib/marketingStudioRoute';

const ID = '11111111-1111-4111-8111-111111111111';

describe('parseTemplateRef', () => {
  it('reads every template ref shape', () => {
    expect(parseTemplateRef('blank')).toEqual({ kind: 'blank' });
    expect(parseTemplateRef('collage')).toEqual({ kind: 'collage' });
    expect(parseTemplateRef('preset:promo-500-off')).toEqual({ kind: 'preset', id: 'promo-500-off' });
    expect(parseTemplateRef(`tpl:${ID}`)).toEqual({ kind: 'template', id: ID });
  });

  it('rejects malformed refs', () => {
    expect(parseTemplateRef(null)).toBeNull();
    expect(parseTemplateRef('preset:')).toBeNull();
    expect(parseTemplateRef('preset:Bad Id')).toBeNull();
    expect(parseTemplateRef('tpl:nope')).toBeNull();
    expect(parseTemplateRef('something')).toBeNull();
  });

  it('round-trips through formatTemplateRef', () => {
    for (const value of ['blank', 'collage', 'preset:quiet-morning', `tpl:${ID}`]) {
      expect(formatTemplateRef(parseTemplateRef(value)!)).toBe(value);
    }
    expect(templateRefEquals({ kind: 'blank' }, { kind: 'blank' })).toBe(true);
    expect(templateRefEquals({ kind: 'preset', id: 'a' }, { kind: 'preset', id: 'b' })).toBe(false);
    expect(templateRefEquals(null, null)).toBe(true);
  });
});

describe('readItemState', () => {
  it('is the Library without an item', () => {
    expect(readItemState(new URLSearchParams('tab=design'))).toEqual({ mode: 'library' });
    expect(readItemState(new URLSearchParams('item=not-a-uuid'))).toEqual({ mode: 'library' });
  });

  it('reads a saved item', () => {
    expect(readItemState(new URLSearchParams(`item=${ID}`))).toEqual({ mode: 'saved', id: ID });
  });

  it('reads a draft with its template and size', () => {
    expect(
      readItemState(new URLSearchParams('item=new&from=preset:slots-3&size=instagram-story'))
    ).toEqual({
      mode: 'draft',
      from: { kind: 'preset', id: 'slots-3' },
      size: 'instagram-story',
    });
    expect(readItemState(new URLSearchParams('item=new&size=../../x'))).toEqual({
      mode: 'draft',
      from: null,
      size: null,
    });
  });
});

describe('param transitions', () => {
  it('opening an item drops draft params', () => {
    const params = new URLSearchParams('tab=design&item=new&from=blank&size=instagram-post');
    applyOpenItem(params, ID);
    expect(params.toString()).toBe(`tab=design&item=${ID}`);
  });

  it('starting a draft replaces an open item', () => {
    const params = new URLSearchParams(`theme=property-colors&item=${ID}`);
    applyStartDraft(params, { from: { kind: 'collage' }, size: 'instagram-story' });
    expect(params.get('item')).toBe('new');
    expect(params.get('from')).toBe('collage');
    expect(params.get('size')).toBe('instagram-story');
    expect(params.get('theme')).toBe('property-colors');
  });

  it('clearItemParams leaves other params', () => {
    const params = new URLSearchParams('tab=video&item=new&from=blank&size=landscape&theme=x');
    clearItemParams(params);
    expect(params.toString()).toBe('tab=video&theme=x');
  });

  it('detects a Library entry in location state', () => {
    expect(cameFromLibrary({ marketingLibraryEntry: true })).toBe(true);
    expect(cameFromLibrary(null)).toBe(false);
    expect(cameFromLibrary({ other: true })).toBe(false);
  });
});

describe('AI Studio params', () => {
  it('starting a new creation sets item=new and the output', () => {
    const params = new URLSearchParams(`tab=generate&item=${ID}&theme=x`);
    applyStartAiSession(params, 'video');
    expect(params.get('item')).toBe('new');
    expect(readAiOutput(params)).toBe('video');
    expect(readItemState(params)).toEqual({ mode: 'draft', from: null, size: null });
  });

  it('ignores unknown outputs and clears output with the item', () => {
    expect(readAiOutput(new URLSearchParams('output=gif'))).toBeNull();
    const params = new URLSearchParams('tab=generate&item=new&output=post');
    clearItemParams(params);
    expect(params.toString()).toBe('tab=generate');
  });

  it('opening a conversation drops the output', () => {
    const params = new URLSearchParams('tab=generate&item=new&output=image');
    applyOpenItem(params, ID);
    expect(params.toString()).toBe(`tab=generate&item=${ID}`);
  });
});
