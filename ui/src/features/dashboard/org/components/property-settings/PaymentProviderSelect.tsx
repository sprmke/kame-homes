import { Fragment } from 'react';

import {
  PAYMENT_PROVIDER_GROUP_LABELS,
  PAYMENT_PROVIDER_GROUP_ORDER,
  paymentProviderLabel,
  providersByGroup,
} from '@/features/dashboard/org/lib/paymentProviders';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PaymentProviderSelectProps = {
  id?: string;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
};

const GROUP_HEADER_CLASS =
  'sticky top-0 z-10 border-b border-border/50 bg-popover/95 px-3 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm';

export function PaymentProviderSelect({
  id,
  value,
  disabled = false,
  onValueChange,
}: PaymentProviderSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="min-h-[44px] w-full">
        <SelectValue placeholder="Select bank or e-wallet">
          {paymentProviderLabel(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className={cn('max-h-[min(60vh,22rem)] max-w-[calc(100vw-24px)] p-0 [&>div]:p-0')}
        position="popper"
      >
        {PAYMENT_PROVIDER_GROUP_ORDER.map((group, groupIndex) => {
          const options = providersByGroup(group);
          if (options.length === 0) return null;

          return (
            <Fragment key={group}>
              {groupIndex > 0 ? <SelectSeparator className="bg-border/60 my-0 h-px" /> : null}
              <SelectGroup className="py-1">
                <SelectLabel className={GROUP_HEADER_CLASS}>
                  {PAYMENT_PROVIDER_GROUP_LABELS[group]}
                </SelectLabel>
                {options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="min-h-[44px] rounded-md pl-9 pr-3"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}
