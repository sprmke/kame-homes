import type { HelpCopyModule } from '@/lib/help/types';

/** Team summary cards. "From organization" members inherit org-level access. */
export const TEAM_HELP_COPY = {
  teamAccess: {
    hint: 'Members who can manage the team, from their role here or because they come from the organization.',
  },
  fromOrg: {
    hint: 'Members who get access through the organization instead of a property invitation.',
  },
} satisfies HelpCopyModule;
