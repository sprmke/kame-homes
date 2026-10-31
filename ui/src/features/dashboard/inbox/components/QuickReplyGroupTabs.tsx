import {
  QUICK_REPLY_GROUP_TABS,
  quickReplyGroupLabel,
  type QuickReplyGroupTab,
} from '@/features/dashboard/inbox/lib/quickReplyGroups';

import { Button } from '@/components/ui/button';

type Props = {
  value: QuickReplyGroupTab;
  onChange: (value: QuickReplyGroupTab) => void;
};

export function QuickReplyGroupFilters({ value, onChange }: Props) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 overflow-x-auto"
      role="group"
      aria-label="Filter by group"
    >
      {QUICK_REPLY_GROUP_TABS.map((tab) => {
        const active = value === tab;
        const label = quickReplyGroupLabel(tab);
        return (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'outline'}
            aria-pressed={active}
            className="h-9 min-h-[44px] shrink-0 px-2.5 sm:min-h-9 sm:px-3"
            onClick={() => onChange(tab)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
