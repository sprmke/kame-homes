import { describe, expect, it, vi } from 'vitest';

import { createUnsavedGuardRegistry, type GuardNavigation } from './registry';

const nav = (over: Partial<GuardNavigation> = {}): GuardNavigation => ({
  currentPathname: '/a',
  currentSearch: '',
  nextPathname: '/b',
  nextSearch: '',
  ...over,
});

describe('unsaved guard registry', () => {
  it('blocks only dirty entries and unregisters cleanly', () => {
    const registry = createUnsavedGuardRegistry();
    let dirty = false;
    const off = registry.register({ id: '1', isDirty: () => dirty });
    expect(registry.hasBlocking(nav())).toBe(false);
    dirty = true;
    expect(registry.hasBlocking(nav())).toBe(true);
    off();
    expect(registry.hasBlocking(nav())).toBe(false);
  });

  it('ignores search-only changes unless the entry blocks on location', () => {
    const registry = createUnsavedGuardRegistry();
    registry.register({ id: 'p', isDirty: () => true });
    const searchOnly = nav({ nextPathname: '/a', nextSearch: '?tab=2' });
    expect(registry.hasBlocking(searchOnly)).toBe(false);
    registry.register({ id: 'l', isDirty: () => true, blocksOn: 'location' });
    expect(registry.hasBlocking(searchOnly)).toBe(true);
  });

  it('treats no navigation (tab close) as blocking for any dirty entry', () => {
    const registry = createUnsavedGuardRegistry();
    registry.register({ id: '1', isDirty: () => true });
    expect(registry.hasBlocking()).toBe(true);
  });

  it('only offers save-all when every blocking entry can save', () => {
    const registry = createUnsavedGuardRegistry();
    registry.register({ id: '1', isDirty: () => true, save: () => true });
    expect(registry.canSaveAll(nav())).toBe(true);
    registry.register({ id: '2', isDirty: () => true });
    expect(registry.canSaveAll(nav())).toBe(false);
    registry.register({ id: '3', isDirty: () => false });
    expect(registry.getBlocking(nav())).toHaveLength(2);
  });

  it('saveAll stops on a false result or a throw', async () => {
    const registry = createUnsavedGuardRegistry();
    const second = vi.fn();
    registry.register({ id: '1', isDirty: () => true, save: async () => false });
    registry.register({ id: '2', isDirty: () => true, save: second });
    expect(await registry.saveAll(nav())).toBe(false);
    expect(second).not.toHaveBeenCalled();

    const throwing = createUnsavedGuardRegistry();
    throwing.register({
      id: '1',
      isDirty: () => true,
      save: () => {
        throw new Error('boom');
      },
    });
    expect(await throwing.saveAll(nav())).toBe(false);
  });

  it('saveAll treats void as success and discardAll only touches blocking entries', async () => {
    const registry = createUnsavedGuardRegistry();
    const discardDirty = vi.fn();
    const discardClean = vi.fn();
    registry.register({
      id: '1',
      isDirty: () => true,
      save: async () => undefined,
      discard: discardDirty,
    });
    registry.register({ id: '2', isDirty: () => false, discard: discardClean });
    expect(await registry.saveAll(nav())).toBe(true);
    registry.discardAll(nav());
    expect(discardDirty).toHaveBeenCalledOnce();
    expect(discardClean).not.toHaveBeenCalled();
  });
});
