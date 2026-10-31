import { ArrowUpDown } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortOption = { value: string; label: string };

type Props = {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
};

/** Sort control for mobile filter sheets (“Filters & Sort”). */
export function FilterSheetSort({ value, options, onChange }: Props) {
  const safe = options.some((o) => o.value === value) ? value : (options[0]?.value ?? '');

  return (
    <div className="border-border space-y-2 border-b pb-6">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="text-muted-foreground h-4 w-4" aria-hidden />
        <label htmlFor="filter-sheet-sort" className="text-foreground text-sm font-semibold">
          Sort
        </label>
      </div>
      <Select value={safe} onValueChange={onChange}>
        <SelectTrigger
          id="filter-sheet-sort"
          aria-label="Sort results"
          className="min-h-[44px] w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-24px)]">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
