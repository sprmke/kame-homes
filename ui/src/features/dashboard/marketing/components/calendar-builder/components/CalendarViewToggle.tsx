import { LayoutGrid, Palette } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CalendarViewMode = 'default' | 'custom';

interface CalendarViewToggleProps {
  value: CalendarViewMode;
  onValueChange: (mode: CalendarViewMode) => void;
  className?: string;
}

export function CalendarViewToggle({ value, onValueChange, className }: CalendarViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className={cn('border-border bg-muted/30 inline-flex rounded-lg border p-0.5', className)}
    >
      <Button
        variant={value === 'default' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('gap-2 rounded-md', value === 'default' && 'shadow-sm')}
        onClick={() => onValueChange('default')}
        aria-pressed={value === 'default'}
      >
        <LayoutGrid className="h-4 w-4" />
        Default calendar
      </Button>
      <Button
        variant={value === 'custom' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('gap-2 rounded-md', value === 'custom' && 'shadow-sm')}
        onClick={() => onValueChange('custom')}
        aria-pressed={value === 'custom'}
      >
        <Palette className="h-4 w-4" />
        Custom design
      </Button>
    </div>
  );
}
