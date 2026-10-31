import { LifeBuoy } from 'lucide-react';

import { ChatComposerContextPicker } from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useSupportTickets } from '@/features/dashboard/help-support/hooks/useSupportTickets';
import type { SupportTicket } from '@/features/dashboard/help-support/lib/supportTicketApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function ChatComposerTicketPicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const propertyId = usePropertyIdParam();
  const { data, isLoading } = useSupportTickets();
  const tickets = data?.tickets ?? [];

  return (
    <ChatComposerContextPicker
      items={tickets}
      getItemId={(ticket) => ticket.id}
      searchHaystack={(ticket) =>
        [ticket.subject, ticket.status, ticket.category, ticket.submitted_by_name].join(' ')
      }
      groupBy={(items) => {
        const map = new Map<string, SupportTicket[]>();
        for (const item of items) {
          const list = map.get(item.status) ?? [];
          list.push(item);
          map.set(item.status, list);
        }
        return [...map.entries()].map(([key, groupItems]) => ({
          key,
          label: STATUS_LABEL[key as SupportTicket['status']] ?? key,
          items: groupItems,
        }));
      }}
      pageEntityId={pageEntityId}
      renderRow={(ticket, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={ticket.subject}
          subtitle={STATUS_LABEL[ticket.status]}
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(ticket) =>
        onSelect({
          type: 'ticket',
          id: ticket.id,
          propertyId: ticket.property_id ?? propertyId,
          label: ticket.subject,
        })
      }
      searchPlaceholder="Ticket"
      searchAriaLabel="Search tickets"
      listAriaLabel="Tickets"
      emptyLabel="No tickets"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={LifeBuoy}
          label="Pin a ticket"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
