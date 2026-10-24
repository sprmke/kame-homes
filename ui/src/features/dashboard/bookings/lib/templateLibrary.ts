import { ClipboardList, FileText, Mail } from 'lucide-react';

import type {
  PropertyTemplateCategory,
  PropertyTemplateDto,
  PropertyTemplateFolderDto,
} from '@/features/dashboard/bookings/hooks/usePropertyTemplates';
import {
  EMAIL_TEMPLATE_SECTIONS,
  STANDARD_TEMPLATE_SECTIONS,
} from '@/features/dashboard/bookings/lib/propertyTemplateSections';

import type { LucideIcon } from 'lucide-react';

/**
 * `builtin` — Stay guide / Emails sections (built-ins plus host-added templates).
 * `folder` — a host-created folder holding custom-category templates.
 * `ungrouped` — custom-category templates that are not in any folder.
 */
export type TemplateLibraryGroupKind = 'builtin' | 'folder' | 'ungrouped';

export type TemplateCategoryFilter = 'all' | 'standard' | 'email' | 'custom';

export type TemplatePlacement = {
  category: PropertyTemplateCategory;
  folderId: string | null;
};

/** Radix Select values for filing a new template or moving an existing one. */
export const TEMPLATE_GROUP_SELECT = {
  UNGROUPED: '__ungrouped__',
  STANDARD_SECTION: '__section_standard__',
  EMAIL_SECTION: '__section_email__',
  NEW_GROUP: '__new_group__',
} as const;

/**
 * `customized` — saved copy differs from the shipped default.
 * `none` — host-owned templates have no shipped default to compare against.
 */
export type TemplateLibraryStatus = 'customized' | 'default' | 'none';

export type TemplateLibraryEntry = {
  templateKey: string;
  name: string;
  icon: LucideIcon;
  category: PropertyTemplateCategory;
  /** Label of the group this template currently sits in, for the pane's meta line. */
  groupLabel: string;
  folderId: string | null;
  status: TemplateLibraryStatus;
  updatedAt: string | null;
  /** Host-owned templates (`custom-*` keys) can be renamed, moved, or deleted. */
  organisable: boolean;
  template: PropertyTemplateDto;
};

export type TemplateLibraryGroup = {
  /** `standard` / `email` / `custom`, or the folder's uuid. */
  id: string;
  kind: TemplateLibraryGroupKind;
  label: string;
  /** Saving in this group needs Starter+ (`customTemplates`). */
  gated: boolean;
  /** Set for `folder` groups, which can be renamed and deleted. */
  folderId: string | null;
  entries: TemplateLibraryEntry[];
};

export const BUILTIN_GROUP_LABELS = {
  standard: 'Stay guide',
  email: 'Emails',
} as const;

/** Where ungrouped custom-category templates live. */
export const UNGROUPED_LABEL = 'Custom';

export function isHostOwnedTemplateKey(templateKey: string): boolean {
  return templateKey.startsWith('custom-');
}

export function placementFromEntry(entry: TemplateLibraryEntry): TemplatePlacement {
  return {
    category: entry.category,
    folderId: entry.category === 'custom' ? entry.folderId : null,
  };
}

export function placementsEqual(a: TemplatePlacement, b: TemplatePlacement): boolean {
  return a.category === b.category && (a.folderId ?? null) === (b.folderId ?? null);
}

export function groupSelectValueFromPlacement(placement: TemplatePlacement): string {
  if (placement.category === 'standard') return TEMPLATE_GROUP_SELECT.STANDARD_SECTION;
  if (placement.category === 'email') return TEMPLATE_GROUP_SELECT.EMAIL_SECTION;
  return placement.folderId ?? TEMPLATE_GROUP_SELECT.UNGROUPED;
}

export function placementFromGroupSelectValue(
  value: string,
  folders: PropertyTemplateFolderDto[] | undefined
): TemplatePlacement | null {
  if (value === TEMPLATE_GROUP_SELECT.NEW_GROUP) return null;
  if (value === TEMPLATE_GROUP_SELECT.STANDARD_SECTION) {
    return { category: 'standard', folderId: null };
  }
  if (value === TEMPLATE_GROUP_SELECT.EMAIL_SECTION) {
    return { category: 'email', folderId: null };
  }
  if (value === TEMPLATE_GROUP_SELECT.UNGROUPED) {
    return { category: 'custom', folderId: null };
  }
  const folder = (folders ?? []).find((row) => row.id === value);
  if (folder) return { category: 'custom', folderId: folder.id };
  return { category: 'custom', folderId: null };
}

function entryFor(
  template: PropertyTemplateDto,
  icon: LucideIcon,
  groupLabel: string
): TemplateLibraryEntry {
  const hostOwned = isHostOwnedTemplateKey(template.templateKey);
  return {
    templateKey: template.templateKey,
    name: template.name,
    icon,
    category: template.category,
    groupLabel,
    folderId: template.category === 'custom' ? template.folderId : null,
    status: hostOwned ? 'none' : template.isDefault ? 'default' : 'customized',
    updatedAt: template.updatedAt,
    organisable: hostOwned,
    template,
  };
}

function byName(a: PropertyTemplateDto, b: PropertyTemplateDto): number {
  return a.name.localeCompare(b.name);
}

/**
 * Builds the rail: Emails, then Stay guide, then host folders, then ungrouped Custom.
 * Built-in sections stay visible when empty so hosts can add templates there.
 */
export function buildTemplateLibrary(
  templates: PropertyTemplateDto[] | undefined,
  folders: PropertyTemplateFolderDto[] | undefined = []
): TemplateLibraryGroup[] {
  const list = templates ?? [];
  const byKey = new Map(list.map((template) => [template.templateKey, template]));
  const hostOwned = list.filter((template) => isHostOwnedTemplateKey(template.templateKey));

  const builtInGroup = (
    id: 'standard' | 'email',
    sections: { templateKey: string; icon: LucideIcon }[]
  ): TemplateLibraryGroup => {
    const label = BUILTIN_GROUP_LABELS[id];
    const hostIcon = id === 'email' ? Mail : FileText;
    const builtInEntries = sections.flatMap((section) => {
      const template = byKey.get(section.templateKey);
      return template ? [entryFor(template, section.icon, label)] : [];
    });
    const hostEntries = hostOwned
      .filter((template) => template.category === id)
      .sort(byName)
      .map((template) => entryFor(template, hostIcon, label));

    return {
      id,
      kind: 'builtin',
      label,
      gated: id === 'email',
      folderId: null,
      entries: [...builtInEntries, ...hostEntries],
    };
  };

  const groups: TemplateLibraryGroup[] = [
    builtInGroup('email', EMAIL_TEMPLATE_SECTIONS),
    builtInGroup('standard', STANDARD_TEMPLATE_SECTIONS),
  ];

  const folderCategoryTemplates = hostOwned.filter((template) => template.category === 'custom');
  const knownFolderIds = new Set((folders ?? []).map((folder) => folder.id));

  const sortedFolders = [...(folders ?? [])].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name)
  );

  for (const folder of sortedFolders) {
    groups.push({
      id: folder.id,
      kind: 'folder',
      label: folder.name,
      gated: true,
      folderId: folder.id,
      entries: folderCategoryTemplates
        .filter((template) => template.folderId === folder.id)
        .sort(byName)
        .map((template) => entryFor(template, ClipboardList, folder.name)),
    });
  }

  const ungrouped = folderCategoryTemplates
    .filter((template) => !template.folderId || !knownFolderIds.has(template.folderId))
    .sort(byName)
    .map((template) => entryFor(template, ClipboardList, UNGROUPED_LABEL));

  if (ungrouped.length > 0) {
    groups.push({
      id: 'custom',
      kind: 'ungrouped',
      label: UNGROUPED_LABEL,
      gated: true,
      folderId: null,
      entries: ungrouped,
    });
  }

  return groups;
}

/** Flattens the rail back to selection order (used for fallbacks and lookups). */
export function templateLibraryEntries(groups: TemplateLibraryGroup[]): TemplateLibraryEntry[] {
  return groups.flatMap((group) => group.entries);
}

export function applyTemplateCategoryFilter(
  groups: TemplateLibraryGroup[],
  filter: TemplateCategoryFilter
): TemplateLibraryGroup[] {
  if (filter === 'all') return groups;

  if (filter === 'custom') {
    return groups
      .filter((group) => group.kind === 'folder' || group.kind === 'ungrouped')
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => entry.category === 'custom'),
      }));
  }

  return groups
    .filter((group) => group.kind === 'builtin' && group.id === filter)
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => entry.category === filter),
    }));
}

/**
 * Narrows the rail by name or group label. Groups left with no entries are
 * dropped so the list never shows a heading with nothing under it — except
 * built-in sections and empty folders when the query is empty (handled upstream).
 */
export function filterTemplateLibrary(
  groups: TemplateLibraryGroup[],
  query: string
): TemplateLibraryGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;

  return groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter(
        (entry) =>
          entry.name.toLowerCase().includes(needle) ||
          group.label.toLowerCase().includes(needle) ||
          entry.templateKey.toLowerCase().includes(needle)
      ),
    }))
    .filter((group) => group.entries.length > 0);
}

export function applyTemplateLibraryFilters(
  groups: TemplateLibraryGroup[],
  query: string,
  categoryFilter: TemplateCategoryFilter
): TemplateLibraryGroup[] {
  return filterTemplateLibrary(applyTemplateCategoryFilter(groups, categoryFilter), query);
}

/**
 * Resolves the `?template=` param against what actually loaded. Falls back to the
 * first entry so the desktop detail pane is never blank; returns null on an empty
 * library so the caller can render its empty state.
 */
export function resolveSelectedTemplateKey(
  groups: TemplateLibraryGroup[],
  requestedKey: string | null | undefined
): string | null {
  const entries = templateLibraryEntries(groups);
  if (entries.length === 0) return null;
  if (requestedKey && entries.some((entry) => entry.templateKey === requestedKey)) {
    return requestedKey;
  }
  const preferredStandard = entries.find((entry) => entry.category === 'standard');
  return preferredStandard?.templateKey ?? entries[0]!.templateKey;
}

export function findTemplateLibraryEntry(
  groups: TemplateLibraryGroup[],
  templateKey: string | null | undefined
): TemplateLibraryEntry | null {
  if (!templateKey) return null;
  return templateLibraryEntries(groups).find((entry) => entry.templateKey === templateKey) ?? null;
}

export type TemplatePlacementTarget = {
  placement: TemplatePlacement;
  label: string;
};

export type TemplatePlacementTargetOptions = {
  /** Ungrouped custom bucket (rail label "Custom"). Omit in create-template Group select. */
  includeUngrouped?: boolean;
};

/** Destinations for Move and the create-template Group select. */
export function templatePlacementTargets(
  folders: PropertyTemplateFolderDto[] | undefined,
  options: TemplatePlacementTargetOptions = {}
): TemplatePlacementTarget[] {
  const sorted = [...(folders ?? [])].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name)
  );
  const targets: TemplatePlacementTarget[] = [
    { placement: { category: 'standard', folderId: null }, label: BUILTIN_GROUP_LABELS.standard },
    { placement: { category: 'email', folderId: null }, label: BUILTIN_GROUP_LABELS.email },
  ];
  if (options.includeUngrouped && sorted.length === 0) {
    targets.push({
      placement: { category: 'custom', folderId: null },
      label: UNGROUPED_LABEL,
    });
  }
  targets.push(
    ...sorted.map((folder) => ({
      placement: { category: 'custom' as const, folderId: folder.id },
      label: folder.name,
    }))
  );
  return targets;
}

/** @deprecated Use templatePlacementTargets */
export function templateMoveTargets(
  folders: PropertyTemplateFolderDto[] | undefined
): { folderId: string | null; label: string }[] {
  return templatePlacementTargets(folders).map((target) => ({
    folderId: target.placement.category === 'custom' ? target.placement.folderId : null,
    label: target.label,
  }));
}

/** Asia/Manila short date; the year only shows when it is not the current one. */
export function formatTemplateUpdatedAt(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    ...(parsed.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * State of one template, without naming its group. Used on rail rows, where the
 * group heading sits directly above and would otherwise repeat on every row.
 */
export function templateStatusParts(entry: TemplateLibraryEntry, now: Date = new Date()): string[] {
  const parts: string[] = [];
  if (entry.status === 'customized') parts.push('Customized');
  if (entry.status === 'default') parts.push('Default');

  const updated = formatTemplateUpdatedAt(entry.updatedAt, now);
  if (updated) parts.push(`Updated ${updated}`);

  return parts;
}

/**
 * Rail-row meta. An untouched built-in says nothing: repeating
 * "Default · Updated Oct 2" down every row is noise the host cannot act on, and
 * it buries the rows that were actually edited.
 */
export function templateRowStatusParts(
  entry: TemplateLibraryEntry,
  now: Date = new Date()
): string[] {
  if (entry.status === 'default') return [];
  return templateStatusParts(entry, now);
}

/** Meta line under the open template's title: where it sits, then its state. */
export function templateMetaParts(entry: TemplateLibraryEntry, now: Date = new Date()): string[] {
  return [entry.groupLabel, ...templateStatusParts(entry, now)];
}
