/** Client mirror of supabase/functions/_shared/orgTeamTemplates.ts */

export const SEEDED_ORG_TEMPLATE_NAMES = {
  FULL_ACCESS: 'Full Access',
  OPERATIONS: 'Operations',
  READ_ONLY: 'Read Only',
} as const;

export type SeededOrgTemplateName =
  (typeof SEEDED_ORG_TEMPLATE_NAMES)[keyof typeof SEEDED_ORG_TEMPLATE_NAMES];

export const SEEDED_ORG_TEMPLATE_NAME_SET = new Set<string>(
  Object.values(SEEDED_ORG_TEMPLATE_NAMES).map((name) => name.toLowerCase())
);

export function isSeededOrgTemplateName(name: string): boolean {
  return SEEDED_ORG_TEMPLATE_NAME_SET.has(name.trim().toLowerCase());
}

export function findOrgTemplateIdByName(
  customRoles: { id: string; name: string }[],
  templateName: SeededOrgTemplateName
): string | undefined {
  const target = templateName.toLowerCase();
  return customRoles.find((role) => role.name.trim().toLowerCase() === target)?.id;
}

export function sortOrgTemplatesForDisplay<T extends { id: string; name: string }>(
  customRoles: T[]
): T[] {
  const order = Object.values(SEEDED_ORG_TEMPLATE_NAMES);
  return [...customRoles].sort((a, b) => {
    const aIndex = order.findIndex((name) => name.toLowerCase() === a.name.trim().toLowerCase());
    const bIndex = order.findIndex((name) => name.toLowerCase() === b.name.trim().toLowerCase());
    const aRank = aIndex === -1 ? order.length + 1 : aIndex;
    const bRank = bIndex === -1 ? order.length + 1 : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
}
