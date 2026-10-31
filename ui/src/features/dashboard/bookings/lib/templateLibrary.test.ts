import { describe, expect, it } from 'vitest';

import type {
  PropertyTemplateDto,
  PropertyTemplateFolderDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import {
  applyTemplateCategoryFilter,
  buildTemplateLibrary,
  filterTemplateLibrary,
  findTemplateLibraryEntry,
  formatTemplateUpdatedAt,
  resolveSelectedTemplateKey,
  templateLibraryEntries,
  templateMetaParts,
  templateMoveTargets,
  templatePlacementTargets,
  templateRowStatusParts,
} from '@/features/dashboard/bookings/lib/templateLibrary';

function template(overrides: Partial<PropertyTemplateDto> = {}): PropertyTemplateDto {
  return {
    templateKey: 'house-rules',
    name: 'House Rules',
    category: 'standard',
    content: '<p>rules</p>',
    defaultContent: '<p>rules</p>',
    isDefault: true,
    description: null,
    previewTemplateSlug: null,
    sectionImageUrl: null,
    folderId: null,
    updatedAt: null,
    ...overrides,
  };
}

function folder(
  overrides: Partial<PropertyTemplateFolderDto> & { id: string; name: string }
): PropertyTemplateFolderDto {
  return { position: 0, templateCount: 0, ...overrides };
}

const standardKeys = ['house-rules', 'check-in-instructions', 'check-out-instructions'];

describe('buildTemplateLibrary', () => {
  it('returns built-in sections when nothing loaded', () => {
    expect(buildTemplateLibrary(undefined)).toEqual([
      expect.objectContaining({ id: 'email', kind: 'builtin', entries: [] }),
      expect.objectContaining({ id: 'standard', kind: 'builtin', entries: [] }),
    ]);
    expect(buildTemplateLibrary([])).toEqual([
      expect.objectContaining({ id: 'email', kind: 'builtin', entries: [] }),
      expect.objectContaining({ id: 'standard', kind: 'builtin', entries: [] }),
    ]);
  });

  it('orders Emails before Stay guide and built-ins by registry', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'check-out-instructions', name: 'Check-out Instructions' }),
      template({ templateKey: 'house-rules', name: 'House Rules' }),
      template({ templateKey: 'check-in-instructions', name: 'Check-in Instructions' }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(['email', 'standard']);
    expect(groups[1]!.entries.map((entry) => entry.templateKey)).toEqual(standardKeys);
  });

  it('skips built-in keys the server did not return', () => {
    const groups = buildTemplateLibrary([template({ templateKey: 'house-rules' })]);

    expect(groups[1]!.entries.map((entry) => entry.templateKey)).toEqual(['house-rules']);
  });

  it('separates email and custom groups and marks email as gated', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules' }),
      template({ templateKey: 'email-gaf-request', name: 'GAF Request', category: 'email' }),
      template({ templateKey: 'custom-welcome', name: 'Welcome', category: 'custom' }),
    ]);

    expect(groups.map((group) => [group.id, group.gated])).toEqual([
      ['email', true],
      ['standard', false],
      ['custom', true],
    ]);
  });

  it('marks built-in entries as not organisable and custom templates as organisable', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules' }),
      template({ templateKey: 'custom-welcome', name: 'Welcome', category: 'custom' }),
    ]);

    expect(groups.map((group) => group.kind)).toEqual(['builtin', 'builtin', 'ungrouped']);
    expect(groups[1]!.entries[0]!.organisable).toBe(false);
    expect(groups[2]!.entries[0]!.organisable).toBe(true);
  });

  it('sorts custom templates by name', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'custom-b', name: 'Zebra note', category: 'custom' }),
      template({ templateKey: 'custom-a', name: 'Arrival tips', category: 'custom' }),
    ]);

    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(ungrouped!.entries.map((entry) => entry.name)).toEqual(['Arrival tips', 'Zebra note']);
  });

  it('files host-owned templates into Stay guide or Emails by category', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'custom-md', name: 'Extra rules', category: 'standard' }),
      template({ templateKey: 'custom-mail', name: 'Extra mail', category: 'email' }),
    ]);

    expect(groups[0]!.entries.map((entry) => entry.templateKey)).toEqual(['custom-mail']);
    expect(groups[1]!.entries.map((entry) => entry.templateKey)).toEqual(['custom-md']);
    expect(groups[0]!.entries[0]!.organisable).toBe(true);
  });

  it('derives customized status from isDefault for built-ins', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules', isDefault: true }),
      template({ templateKey: 'check-in-instructions', isDefault: false }),
    ]);

    expect(groups[1]!.entries.map((entry) => entry.status)).toEqual(['default', 'customized']);
  });

  it('reports no status for custom templates, which have no shipped default', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'custom-a', name: 'A', category: 'custom', isDefault: false }),
    ]);

    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(ungrouped!.entries[0]!.status).toBe('none');
  });
});

describe('buildTemplateLibrary — folders', () => {
  const customA = template({
    templateKey: 'custom-a',
    name: 'Arrival tips',
    category: 'custom',
    folderId: 'f1',
  });
  const customB = template({
    templateKey: 'custom-b',
    name: 'Late checkout',
    category: 'custom',
    folderId: null,
  });

  it('orders Emails and Stay guide first, then folders by position, then ungrouped', () => {
    const groups = buildTemplateLibrary(
      [template({ templateKey: 'house-rules' }), customA, customB],
      [
        folder({ id: 'f2', name: 'Zebra', position: 1 }),
        folder({ id: 'f1', name: 'Arrival', position: 0 }),
      ]
    );

    expect(groups.map((group) => [group.kind, group.label])).toEqual([
      ['builtin', 'Emails'],
      ['builtin', 'Stay guide'],
      ['folder', 'Arrival'],
      ['folder', 'Zebra'],
      ['ungrouped', 'Custom'],
    ]);
  });

  it('files each custom template under its folder', () => {
    const groups = buildTemplateLibrary(
      [customA, customB],
      [folder({ id: 'f1', name: 'Arrival' })]
    );

    const arrival = groups.find((group) => group.folderId === 'f1');
    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(arrival!.entries.map((entry) => entry.templateKey)).toEqual(['custom-a']);
    expect(ungrouped!.entries.map((entry) => entry.templateKey)).toEqual(['custom-b']);
  });

  it('keeps an empty folder so it can receive templates', () => {
    const groups = buildTemplateLibrary([], [folder({ id: 'f1', name: 'Arrival' })]);

    const folderGroup = groups.find((group) => group.folderId === 'f1');
    expect(folderGroup!.entries).toEqual([]);
  });

  it('hides the ungrouped section when every custom template is filed', () => {
    const groups = buildTemplateLibrary([customA], [folder({ id: 'f1', name: 'Arrival' })]);

    expect(groups.some((group) => group.kind === 'ungrouped')).toBe(false);
  });

  it('falls back to ungrouped when a template points at a folder that did not load', () => {
    const orphan = template({
      templateKey: 'custom-orphan',
      name: 'Orphan',
      category: 'custom',
      folderId: 'gone',
    });
    const groups = buildTemplateLibrary([orphan], []);

    expect(groups.some((group) => group.kind === 'ungrouped')).toBe(true);
    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(ungrouped!.entries[0]!.templateKey).toBe('custom-orphan');
  });

  it('labels an entry with the folder holding it', () => {
    const groups = buildTemplateLibrary([customA], [folder({ id: 'f1', name: 'Arrival' })]);

    const arrival = groups.find((group) => group.folderId === 'f1');
    expect(arrival!.entries[0]!.groupLabel).toBe('Arrival');
  });

  it('ignores folderId on a built-in template', () => {
    const groups = buildTemplateLibrary([template({ templateKey: 'house-rules', folderId: 'f1' })]);

    expect(groups[1]!.entries[0]!.folderId).toBeNull();
  });
});

describe('templatePlacementTargets', () => {
  it('lists Stay guide, Emails, then folders (no ungrouped Custom in create Group select)', () => {
    expect(templatePlacementTargets([]).map((target) => target.label)).toEqual([
      'Stay guide',
      'Emails',
    ]);
  });

  it('lists folders after the built-in destinations', () => {
    expect(
      templatePlacementTargets([
        folder({ id: 'f2', name: 'Zebra', position: 1 }),
        folder({ id: 'f1', name: 'Arrival', position: 0 }),
      ]).map((target) => target.label)
    ).toEqual(['Stay guide', 'Emails', 'Arrival', 'Zebra']);
  });

  it('includes ungrouped Custom for Move only when there are no host folders', () => {
    expect(
      templatePlacementTargets([], { includeUngrouped: true }).map((target) => target.label)
    ).toEqual(['Stay guide', 'Emails', 'Custom']);
    expect(
      templatePlacementTargets([folder({ id: 'f1', name: 'Arrival' })], {
        includeUngrouped: true,
      }).map((target) => target.label)
    ).toEqual(['Stay guide', 'Emails', 'Arrival']);
  });
});

/** @deprecated wrapper still used in a few call sites */
describe('templateMoveTargets', () => {
  it('maps custom-only folder ids for legacy callers', () => {
    expect(templateMoveTargets([])).toEqual([
      { folderId: null, label: 'Stay guide' },
      { folderId: null, label: 'Emails' },
    ]);
  });
});

describe('applyTemplateCategoryFilter', () => {
  const groups = buildTemplateLibrary([
    template({ templateKey: 'house-rules' }),
    template({ templateKey: 'email-gaf-request', name: 'GAF Request', category: 'email' }),
    template({ templateKey: 'custom-a', name: 'A', category: 'custom' }),
  ]);

  it('passes everything through for all', () => {
    expect(applyTemplateCategoryFilter(groups, 'all')).toBe(groups);
  });

  it('shows only the Emails section when filtered to email', () => {
    const filtered = applyTemplateCategoryFilter(groups, 'email');
    expect(filtered.map((group) => group.id)).toEqual(['email']);
  });

  it('shows only Stay guide when filtered to standard', () => {
    const filtered = applyTemplateCategoryFilter(groups, 'standard');
    expect(filtered.map((group) => group.id)).toEqual(['standard']);
  });

  it('shows host folders and ungrouped Custom when filtered to custom', () => {
    const withFolder = buildTemplateLibrary(
      [
        template({ templateKey: 'house-rules' }),
        template({ templateKey: 'custom-a', name: 'A', category: 'custom' }),
        template({
          templateKey: 'custom-b',
          name: 'B',
          category: 'custom',
          folderId: 'f1',
        }),
      ],
      [folder({ id: 'f1', name: 'Arrival' })]
    );
    const filtered = applyTemplateCategoryFilter(withFolder, 'custom');
    expect(filtered.map((group) => group.label)).toEqual(['Arrival', 'Custom']);
    expect(filtered.flatMap((group) => group.entries.map((e) => e.name))).toEqual(['B', 'A']);
  });
});

describe('filterTemplateLibrary', () => {
  const groups = buildTemplateLibrary([
    template({ templateKey: 'house-rules', name: 'House Rules' }),
    template({ templateKey: 'check-in-instructions', name: 'Check-in Instructions' }),
    template({ templateKey: 'email-gaf-request', name: 'GAF Request', category: 'email' }),
  ]);

  it('passes everything through for a blank query', () => {
    expect(filterTemplateLibrary(groups, '   ')).toBe(groups);
  });

  it('matches names case-insensitively', () => {
    const filtered = filterTemplateLibrary(groups, 'HOUSE');

    expect(templateLibraryEntries(filtered).map((entry) => entry.templateKey)).toEqual([
      'house-rules',
    ]);
  });

  it('matches on the group label so a category name finds its templates', () => {
    const filtered = filterTemplateLibrary(groups, 'emails');

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe('email');
  });

  it('matches on the template key', () => {
    const filtered = filterTemplateLibrary(groups, 'check-in');

    expect(templateLibraryEntries(filtered).map((entry) => entry.templateKey)).toEqual([
      'check-in-instructions',
    ]);
  });

  it('drops groups left with no entries instead of showing a bare heading', () => {
    const filtered = filterTemplateLibrary(groups, 'gaf');

    expect(filtered.map((group) => group.id)).toEqual(['email']);
  });

  it('returns no groups when nothing matches', () => {
    expect(filterTemplateLibrary(groups, 'nothing here')).toEqual([]);
  });
});

describe('resolveSelectedTemplateKey', () => {
  const groups = buildTemplateLibrary([
    template({ templateKey: 'house-rules' }),
    template({ templateKey: 'check-in-instructions' }),
  ]);

  it('keeps a requested key that exists', () => {
    expect(resolveSelectedTemplateKey(groups, 'check-in-instructions')).toBe(
      'check-in-instructions'
    );
  });

  it('falls back to the first entry for an unknown or missing key', () => {
    expect(resolveSelectedTemplateKey(groups, 'deleted-custom')).toBe('house-rules');
    expect(resolveSelectedTemplateKey(groups, null)).toBe('house-rules');
  });

  it('returns null for an empty library so the caller can show an empty state', () => {
    expect(resolveSelectedTemplateKey([], 'house-rules')).toBeNull();
  });
});

describe('findTemplateLibraryEntry', () => {
  const groups = buildTemplateLibrary([template({ templateKey: 'house-rules' })]);

  it('finds an entry by key', () => {
    expect(findTemplateLibraryEntry(groups, 'house-rules')?.name).toBe('House Rules');
  });

  it('returns null for a missing or blank key', () => {
    expect(findTemplateLibraryEntry(groups, 'nope')).toBeNull();
    expect(findTemplateLibraryEntry(groups, null)).toBeNull();
  });
});

describe('formatTemplateUpdatedAt', () => {
  const now = new Date('2026-10-21T00:00:00Z');

  it('returns null for missing or unparseable input', () => {
    expect(formatTemplateUpdatedAt(null, now)).toBeNull();
    expect(formatTemplateUpdatedAt('not a date', now)).toBeNull();
  });

  it('omits the year within the current year', () => {
    expect(formatTemplateUpdatedAt('2026-10-18T09:00:00Z', now)).toBe('Oct 18');
  });

  it('includes the year for an older edit', () => {
    expect(formatTemplateUpdatedAt('2025-03-02T09:00:00Z', now)).toBe('Mar 2, 2025');
  });

  it('formats in Asia/Manila, so a late UTC timestamp reads as the next local day', () => {
    expect(formatTemplateUpdatedAt('2026-10-18T20:00:00Z', now)).toBe('Oct 19');
  });
});

describe('templateMetaParts', () => {
  const now = new Date('2026-10-21T00:00:00Z');

  it('leads with the group, then the status', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules', isDefault: true }),
    ]);

    expect(templateMetaParts(groups[1]!.entries[0]!, now)).toEqual(['Stay guide', 'Default']);
  });

  it('adds the updated date when the template has been saved', () => {
    const groups = buildTemplateLibrary([
      template({
        templateKey: 'email-gaf-request',
        name: 'GAF Request',
        category: 'email',
        isDefault: false,
        updatedAt: '2026-10-18T09:00:00Z',
      }),
    ]);

    expect(templateMetaParts(groups[0]!.entries[0]!, now)).toEqual([
      'Emails',
      'Customized',
      'Updated Oct 18',
    ]);
  });

  it('omits the status for a custom template', () => {
    const groups = buildTemplateLibrary([
      template({
        templateKey: 'custom-a',
        name: 'Arrival tips',
        category: 'custom',
        isDefault: false,
        updatedAt: '2026-10-20T09:00:00Z',
      }),
    ]);

    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(templateMetaParts(ungrouped!.entries[0]!, now)).toEqual(['Custom', 'Updated Oct 20']);
  });

  it('names the folder a filed template sits in', () => {
    const groups = buildTemplateLibrary(
      [
        template({
          templateKey: 'custom-a',
          name: 'Arrival tips',
          category: 'custom',
          folderId: 'f1',
          updatedAt: '2026-10-20T09:00:00Z',
        }),
      ],
      [folder({ id: 'f1', name: 'Arrival' })]
    );

    const arrival = groups.find((group) => group.folderId === 'f1');
    expect(templateMetaParts(arrival!.entries[0]!, now)).toEqual(['Arrival', 'Updated Oct 20']);
  });
});

describe('templateRowStatusParts', () => {
  const now = new Date('2026-10-21T00:00:00Z');

  it('says nothing for an untouched built-in', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules', isDefault: true, updatedAt: '2026-10-18T09:00:00Z' }),
    ]);

    expect(templateRowStatusParts(groups[1]!.entries[0]!, now)).toEqual([]);
  });

  it('flags an edited built-in with its date', () => {
    const groups = buildTemplateLibrary([
      template({ templateKey: 'house-rules', isDefault: false, updatedAt: '2026-10-18T09:00:00Z' }),
    ]);

    expect(templateRowStatusParts(groups[1]!.entries[0]!, now)).toEqual([
      'Customized',
      'Updated Oct 18',
    ]);
  });

  it('keeps the date on a custom template', () => {
    const groups = buildTemplateLibrary([
      template({
        templateKey: 'custom-a',
        name: 'Arrival tips',
        category: 'custom',
        updatedAt: '2026-10-20T09:00:00Z',
      }),
    ]);

    const ungrouped = groups.find((group) => group.kind === 'ungrouped');
    expect(templateRowStatusParts(ungrouped!.entries[0]!, now)).toEqual(['Updated Oct 20']);
  });
});
