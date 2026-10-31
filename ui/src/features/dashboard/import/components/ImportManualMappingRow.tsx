import { ChevronRight } from 'lucide-react';

import {
  OPTIONAL_TARGET_FIELDS,
  REQUIRED_TARGET_FIELDS,
} from '@/features/dashboard/import/lib/importTargetFields';
import type { ImportColumnMappingEntry } from '@/features/dashboard/import/types/importBatch';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const SKIP_VALUE = '__skip__';

type Props = {
  entry: ImportColumnMappingEntry;
  /** Up to 3 sample values for this column. */
  samples: string[];
  /** Current user-chosen target (null = skip). */
  value: string | null;
  onChange: (rawHeader: string, target: string | null) => void;
  /** Already-used target ids (disables duplicate mapping). */
  usedTargets: Set<string>;
};

type StatusBadge = { label: string; className: string };

const UNMATCHED_BADGE: StatusBadge = {
  label: 'No match',
  className: 'border-border bg-transparent text-muted-foreground',
};

const STATUS_BADGE: Partial<Record<ImportColumnMappingEntry['status'], StatusBadge>> = {
  matched: { label: 'Matched', className: compactStatusBadgeClasses('success') },
  confirmed: { label: 'Matched', className: compactStatusBadgeClasses('success') },
  likely_matched: { label: 'Likely match', className: compactStatusBadgeClasses('neutral') },
  ambiguous: { label: 'Not sure', className: compactStatusBadgeClasses('warning') },
  skipped: { label: 'Skipped', className: 'border-border bg-transparent text-muted-foreground' },
  unmatched: UNMATCHED_BADGE,
};

export function ImportManualMappingRow({ entry, samples, value, onChange, usedTargets }: Props) {
  const selectValue = value ?? SKIP_VALUE;
  const badge = STATUS_BADGE[entry.status] ?? UNMATCHED_BADGE;
  const nonEmptySamples = samples.filter(Boolean).slice(0, 3);

  const handleChange = (next: string) => {
    onChange(entry.rawHeader, next === SKIP_VALUE ? null : next);
  };

  const renderOption = (field: { id: string; description: string }) => {
    const takenByAnotherColumn = usedTargets.has(field.id) && value !== field.id;
    return (
      <SelectItem key={field.id} value={field.id} disabled={takenByAnotherColumn}>
        {field.description}
      </SelectItem>
    );
  };

  return (
    <div
      className={cn(
        'border-border/70 grid grid-cols-1 items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5',
        'sm:grid-cols-[minmax(0,1fr)_1rem_minmax(0,15rem)]',
        value === null && 'bg-muted/20'
      )}
    >
      {/* Column in the host's file */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-foreground min-w-0 truncate text-sm font-medium">{entry.rawHeader}</p>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', badge.className)}>
            {badge.label}
          </Badge>
        </div>
        {nonEmptySamples.length > 0 ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {nonEmptySamples.join(' · ')}
          </p>
        ) : null}
      </div>

      <ChevronRight className="text-muted-foreground/60 hidden size-4 sm:block" aria-hidden />

      {/* Booking field it maps to */}
      <Select value={selectValue} onValueChange={handleChange}>
        <SelectTrigger
          className="min-h-11 w-full text-xs"
          aria-label={`Booking field for ${entry.rawHeader}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SKIP_VALUE}>
            <span className="text-muted-foreground">Skip this column</span>
          </SelectItem>

          <SelectGroup>
            <SelectLabel className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Required
            </SelectLabel>
            {REQUIRED_TARGET_FIELDS.map(renderOption)}
          </SelectGroup>

          <SelectGroup>
            <SelectLabel className="text-muted-foreground text-[10px] uppercase tracking-wide">
              Optional
            </SelectLabel>
            {OPTIONAL_TARGET_FIELDS.map(renderOption)}
          </SelectGroup>
        </SelectContent>
      </Select>

      {entry.reason && entry.status !== 'matched' ? (
        <p className="text-muted-foreground col-span-full line-clamp-2 text-[11px]">
          {entry.reason}
        </p>
      ) : null}
    </div>
  );
}
