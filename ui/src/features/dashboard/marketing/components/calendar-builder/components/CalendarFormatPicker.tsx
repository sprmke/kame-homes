import { useCalendarBuilderStore } from '@/features/dashboard/marketing/components/calendar-builder/stores/calendarBuilderStore';
import { MarketingFormatPicker } from '@/features/dashboard/marketing/components/shared/MarketingFormatPicker';
import {
  CALENDAR_FORMAT_OPTIONS,
  canvasFrameDefaultsForFormat,
  normalizeCalendarCanvasFrame,
  type CalendarCanvasFormat,
} from '@/features/dashboard/marketing/lib/calendarCanvasFormats';

type Props = {
  brandColor?: string;
  onFormatChange?: (format: CalendarCanvasFormat) => void;
};

export function CalendarFormatPicker({ brandColor, onFormatChange }: Props) {
  const { styles, updateStyles, saveToHistory } = useCalendarBuilderStore();
  const frame = normalizeCalendarCanvasFrame(styles.canvasFrame, brandColor);

  const handleFormatChange = (value: string) => {
    const format = value as CalendarCanvasFormat;
    if (onFormatChange) {
      onFormatChange(format);
      return;
    }

    const defaults = canvasFrameDefaultsForFormat(format, brandColor);
    updateStyles('canvasFrame.format', format);
    updateStyles('canvasFrame.padding', defaults.padding);
    updateStyles('canvasFrame.calendarScale', defaults.calendarScale);
    updateStyles('canvasFrame.background', defaults.background);
    saveToHistory();
  };

  return (
    <div className="relative z-[2] shrink-0">
      <MarketingFormatPicker
        options={CALENDAR_FORMAT_OPTIONS}
        value={frame.format}
        onChange={handleFormatChange}
      />
    </div>
  );
}
