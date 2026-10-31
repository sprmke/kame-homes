export function normalizeTeamMemberEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isCurrentTeamMember(
  memberEmail: string,
  currentUserEmail: string | null | undefined
): boolean {
  if (!currentUserEmail) return false;
  return normalizeTeamMemberEmail(memberEmail) === normalizeTeamMemberEmail(currentUserEmail);
}

export function sortTeamMembersWithCurrentUserFirst<T extends { email: string }>(
  members: readonly T[],
  currentUserEmail: string | null | undefined
): T[] {
  if (!currentUserEmail) return [...members];
  const normalized = normalizeTeamMemberEmail(currentUserEmail);
  return [...members].sort((a, b) => {
    const aIsCurrent = normalizeTeamMemberEmail(a.email) === normalized;
    const bIsCurrent = normalizeTeamMemberEmail(b.email) === normalized;
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;
    return 0;
  });
}

export const currentTeamMemberRowClassName =
  'border-primary/40 bg-primary/5 dark:border-primary/50 dark:bg-primary/10';
