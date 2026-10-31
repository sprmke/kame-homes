import { Building2, CalendarDays, ChevronsLeftRight, Eye, LayoutList, Type } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { useCalendarBuilderStore } from '../stores/calendarBuilderStore';

const ELEMENT_ITEMS = [
  {
    path: 'header.propertyName.show',
    label: 'Property name',
    icon: Building2,
  },
  {
    path: 'header.monthYear.show',
    label: 'Month & Year',
    icon: CalendarDays,
  },
  {
    path: 'header.navigation.show',
    label: 'Prev / Next buttons',
    icon: ChevronsLeftRight,
  },
  {
    path: 'header.subtitle.show',
    label: 'Subtitle',
    icon: Type,
  },
  {
    path: 'dayNames.show',
    label: 'Day names (Mon, Tue…)',
    icon: LayoutList,
  },
  {
    path: 'legend.show',
    label: 'Legend',
    icon: LayoutList,
  },
  {
    path: 'watermark.show',
    label: 'Watermark',
    icon: Type,
  },
] as const;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function CalendarElementToggles() {
  const { styles, updateStyles } = useCalendarBuilderStore();

  const stylesObj = styles as unknown as Record<string, unknown>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          Show / Hide
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="border-border border-b px-3 py-2">
          <p className="text-foreground text-sm font-medium">Calendar elements</p>
          <p className="text-muted-foreground text-xs">
            Toggle visibility of elements on the calendar
          </p>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          <div className="space-y-0.5">
            {ELEMENT_ITEMS.map(({ path, label, icon: Icon }) => {
              const value = getNestedValue(stylesObj, path);
              const checked = value === true;
              return (
                <label
                  key={path}
                  className={cn(
                    'hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(checked) => updateStyles(path, checked === true)}
                    aria-label={label}
                  />
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      checked ? 'text-muted-foreground' : 'text-muted-foreground/50'
                    )}
                  />
                  <span className="text-foreground flex-1">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
