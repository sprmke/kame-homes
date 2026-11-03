import { describe, expect, it } from 'vitest';

import {
  resolveShortcut,
  type ShortcutInput,
} from '@/features/dashboard/marketing/lib/video/v2/shortcuts';

const base: ShortcutInput = {
  key: '',
  mod: false,
  shift: false,
  alt: false,
  typing: false,
  onClip: false,
  onControl: false,
};
const press = (over: Partial<ShortcutInput>) => resolveShortcut({ ...base, ...over }, 30);

describe('resolveShortcut', () => {
  it('maps the basic keys', () => {
    expect(press({ key: ' ' })).toEqual({ type: 'toggle-play' });
    expect(press({ key: 's' })).toEqual({ type: 'split' });
    expect(press({ key: 'S' })).toEqual({ type: 'split' });
    expect(press({ key: 'Delete' })).toEqual({ type: 'delete', ripple: false });
    expect(press({ key: 'Backspace', shift: true })).toEqual({ type: 'delete', ripple: true });
    expect(press({ key: 'Escape' })).toEqual({ type: 'deselect' });
  });

  it('maps modifier combos', () => {
    expect(press({ key: 'd', mod: true })).toEqual({ type: 'duplicate' });
    expect(press({ key: 'c', mod: true })).toEqual({ type: 'copy' });
    expect(press({ key: 'v', mod: true })).toEqual({ type: 'paste' });
    expect(press({ key: 'a', mod: true })).toEqual({ type: 'select-all' });
    expect(press({ key: 'z', mod: true })).toBeNull();
    expect(press({ key: 's', mod: true })).toBeNull();
  });

  it('steps one frame or one second', () => {
    expect(press({ key: 'ArrowRight' })).toEqual({ type: 'step', frames: 1 });
    expect(press({ key: 'ArrowLeft', shift: true })).toEqual({ type: 'step', frames: -30 });
  });

  it('leaves arrows to a focused clip', () => {
    expect(press({ key: 'ArrowRight', onClip: true })).toBeNull();
  });

  it('leaves Space to a focused control', () => {
    expect(press({ key: ' ', onControl: true })).toBeNull();
  });

  it('ignores everything while typing or with Alt', () => {
    expect(press({ key: 's', typing: true })).toBeNull();
    expect(press({ key: 'Delete', typing: true })).toBeNull();
    expect(press({ key: 'ArrowLeft', alt: true })).toBeNull();
  });
});
