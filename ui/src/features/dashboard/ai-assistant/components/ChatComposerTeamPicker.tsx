import { Users } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import {
  useOrgIdParam,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';
import { useOrgTeam } from '@/features/dashboard/team/hooks/useOrgTeam';
import { useParkingTeam } from '@/features/dashboard/team/hooks/useParkingTeam';
import { usePropertyTeam } from '@/features/dashboard/team/hooks/usePropertyTeam';
import type { OrgTeamMember } from '@/features/dashboard/team/types/orgTeam';
import type { TeamMember } from '@/features/dashboard/team/types/propertyTeam';

type TeamRow = {
  id: string;
  title: string;
  subtitle: string;
};

function toTeamRow(member: TeamMember | OrgTeamMember): TeamRow {
  const title = member.displayName || member.name || member.email;
  return { id: member.id, title, subtitle: member.email };
}

function TeamMemberListPicker({
  members,
  isLoading,
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
}: ComposerPickerSharedProps & { members: TeamRow[]; isLoading: boolean }) {
  return (
    <ChatComposerContextPicker
      items={members}
      getItemId={(member) => member.id}
      searchHaystack={(member) => `${member.title} ${member.subtitle}`}
      renderRow={(member, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={member.title}
          subtitle={member.subtitle}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(member) =>
        onSelect({
          type: 'team_member',
          id: member.id,
          label: member.title,
        })
      }
      searchPlaceholder="Name or email"
      searchAriaLabel="Search team"
      listAriaLabel="Team"
      emptyLabel="No members"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Users}
          label="Pin a team member"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}

function OrgTeamPicker(props: ComposerPickerSharedProps) {
  const orgId = useOrgIdParam();
  const { data, isLoading } = useOrgTeam(orgId);
  const members = (data?.members ?? []).map(toTeamRow);
  return <TeamMemberListPicker {...props} members={members} isLoading={isLoading} />;
}

function PropertyTeamPicker(props: ComposerPickerSharedProps) {
  const { data, isLoading } = usePropertyTeam();
  const members = (data?.members ?? []).map(toTeamRow);
  return <TeamMemberListPicker {...props} members={members} isLoading={isLoading} />;
}

function ParkingTeamPicker(props: ComposerPickerSharedProps) {
  const { data, isLoading } = useParkingTeam();
  const members = (data?.members ?? []).map(toTeamRow);
  return <TeamMemberListPicker {...props} members={members} isLoading={isLoading} />;
}

export function ChatComposerTeamPicker(props: ComposerPickerSharedProps) {
  const parkingId = useParkingIdParam();
  const propertyId = usePropertyIdParam();
  if (parkingId) return <ParkingTeamPicker {...props} />;
  if (propertyId) return <PropertyTeamPicker {...props} />;
  return <OrgTeamPicker {...props} />;
}
