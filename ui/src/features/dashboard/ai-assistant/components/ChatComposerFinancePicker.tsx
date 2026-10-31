import { format, parseISO } from 'date-fns';
import { Ticket } from 'lucide-react';

import {
  ChatComposerContextPicker,
  type ContextPickerGroup,
} from '@/features/dashboard/ai-assistant/components/ChatComposerContextPicker';
import {
  ChatComposerPickerRow,
  ChatComposerPickerTrigger,
} from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import type { ComposerPickerSharedProps } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { useFinanceLineItems } from '@/features/dashboard/finance/hooks/useFinanceLineItems';
import {
  DEFAULT_FINANCE_QUERY,
  type FinanceLineItem,
} from '@/features/dashboard/finance/lib/types';

import { formatMoney } from '@/utils/format/currency';

function groupByOccurredMonth(items: FinanceLineItem[]): ContextPickerGroup<FinanceLineItem>[] {
  const map = new Map<string, ContextPickerGroup<FinanceLineItem>>();
  for (const item of items) {
    const key = item.occurred_on.slice(0, 7);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    let label = key;
    try {
      label = format(parseISO(`${key}-01`), 'MMMM yyyy');
    } catch {
      /* keep key */
    }
    map.set(key, { key, label, items: [item] });
  }
  return [...map.values()];
}

export function ChatComposerFinancePicker({
  selectedIds,
  onSelect,
  disabled,
  overlayContainer,
  pageEntityId,
}: ComposerPickerSharedProps) {
  const { data, isLoading } = useFinanceLineItems({ ...DEFAULT_FINANCE_QUERY, limit: 80 });
  const items = data ?? [];

  return (
    <ChatComposerContextPicker
      items={items}
      getItemId={(item) => item.id}
      searchHaystack={(item) =>
        [item.label, item.kind, item.category, item.occurred_on, String(item.amount)].join(' ')
      }
      groupBy={groupByOccurredMonth}
      pageEntityId={pageEntityId}
      renderRow={(item, { selected, hint, onSelect: pick }) => (
        <ChatComposerPickerRow
          title={item.label}
          subtitle={`${item.kind === 'income' ? 'Income' : 'Expense'} · ${item.occurred_on}`}
          trailing={
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatMoney(item.amount)}
            </span>
          }
          hint={hint}
          selected={selected}
          onSelect={pick}
        />
      )}
      selectedIds={selectedIds}
      onSelect={(item) =>
        onSelect({
          type: 'finance_item',
          id: item.id,
          label: item.label,
        })
      }
      searchPlaceholder="Transaction"
      searchAriaLabel="Search transactions"
      listAriaLabel="Transactions"
      emptyLabel="No transactions"
      isLoading={isLoading}
      overlayContainer={overlayContainer}
      trigger={
        <ChatComposerPickerTrigger
          icon={Ticket}
          label="Pin a transaction"
          pressed={selectedIds.size > 0}
          disabled={disabled}
        />
      }
    />
  );
}
