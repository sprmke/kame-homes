import { CalendarViewToggle } from './CalendarViewToggle';

interface CalendarViewPageHeaderProps {
  viewMode: 'default' | 'custom';
  onViewModeChange: (mode: 'default' | 'custom') => void;
}

export function CalendarViewPageHeader({
  viewMode,
  onViewModeChange,
}: CalendarViewPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">Calendar</h1>
        <p className="text-muted-foreground">
          View bookings by day. Click a date to see details on the right.
        </p>
      </div>
      <CalendarViewToggle value={viewMode} onValueChange={onViewModeChange} />
    </div>
  );
}
