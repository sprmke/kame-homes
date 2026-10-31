import { forwardRef, useMemo } from 'react';

import { addDays, eachDayOfInterval, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  buildCalendarWeekRows,
  buildOccupancySegmentsForWeeks,
  calendarOccupancySpanPosition,
} from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';

import {
  useCalendarBuilderStore,
  MOCK_BLOCKED_DAYS,
  MOCK_PREVIEW_BOOKINGS,
} from '../stores/calendarBuilderStore';
import {
  type CalendarStyles,
  type PreviewBooking,
  type BackgroundConfig,
  type BorderConfig,
  type SpacingConfig,
  type FontConfig,
  type ShadowConfig,
} from '../types';

interface CalendarPreviewProps {
  styles: CalendarStyles;
  propertyName?: string;
  bookings?: PreviewBooking[];
  blockedDays?: number[];
  /** When provided, use this month instead of the store's previewMonth (e.g. on main calendar page) */
  displayMonth?: Date;
  /** Overrides `styles.container.maxWidth` (e.g. square frame export size). */
  layoutMaxWidth?: number;
}

// Day names
const DAY_NAMES = {
  full: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

// Month names
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Helpers
function getBackgroundStyle(config: BackgroundConfig): React.CSSProperties {
  if (config.type === 'solid') {
    return { backgroundColor: config.color };
  }

  if (config.type === 'gradient' && config.gradient) {
    const { type, angle, stops } = config.gradient;
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopsString = sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ');

    if (type === 'linear') {
      return { background: `linear-gradient(${angle}deg, ${stopsString})` };
    }
    return { background: `radial-gradient(circle, ${stopsString})` };
  }

  if (config.type === 'image') {
    // Support both old format (config.image.url) and new format (config.imageUrl)
    const url = config.imageUrl || config.image?.url;
    const size = config.imageSize || config.image?.size || 'cover';
    const position = config.imagePosition || config.image?.position || 'center';
    const repeat = config.image?.repeat || 'no-repeat';

    if (!url) {
      return { backgroundColor: config.color || '#ffffff' };
    }

    // Apply overlay if provided
    const overlayColor = config.overlay;
    if (overlayColor) {
      return {
        backgroundImage: `linear-gradient(${overlayColor}, ${overlayColor}), url(${url})`,
        backgroundSize: size === 'auto' ? 'auto' : size,
        backgroundPosition: position,
        backgroundRepeat: repeat,
      };
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: size === 'auto' ? 'auto' : size,
      backgroundPosition: position,
      backgroundRepeat: repeat,
    };
  }

  if (config.type === 'pattern' && config.pattern) {
    const { type, size, opacity } = config.pattern;
    // Use rgba for pattern colors
    const patternColor = `rgba(0,0,0,${opacity})`;

    switch (type) {
      case 'dots':
        return {
          backgroundColor: config.color,
          backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'grid':
        return {
          backgroundColor: config.color,
          backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(to right, ${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'lines':
        return {
          backgroundColor: config.color,
          backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'diagonal':
        return {
          backgroundColor: config.color,
          backgroundImage: `repeating-linear-gradient(45deg, ${patternColor}, ${patternColor} 1px, transparent 1px, transparent ${size}px)`,
        };
      default:
        return { backgroundColor: config.color };
    }
  }

  return { backgroundColor: config.color };
}

function getBorderStyle(config: BorderConfig): React.CSSProperties {
  if (config.style === 'none') {
    return { border: 'none', borderRadius: config.radius };
  }
  return {
    borderWidth: config.width,
    borderStyle: config.style,
    borderColor: config.color,
    borderRadius: config.radius,
  };
}

function getSpacingStyle(config: SpacingConfig, prefix: 'padding' | 'margin'): React.CSSProperties {
  return {
    [`${prefix}Top`]: config.top,
    [`${prefix}Right`]: config.right,
    [`${prefix}Bottom`]: config.bottom,
    [`${prefix}Left`]: config.left,
  };
}

function getFontStyle(config: FontConfig): React.CSSProperties {
  return {
    fontFamily: config.family,
    fontSize: config.size,
    fontWeight: config.weight,
    lineHeight: config.lineHeight,
    letterSpacing: config.letterSpacing,
    textTransform: config.textTransform,
  };
}

function getShadowStyle(config: ShadowConfig): React.CSSProperties {
  if (!config.enabled) return {};

  const inset = config.inset ? 'inset ' : '';
  return {
    boxShadow: `${inset}${config.x}px ${config.y}px ${config.blur}px ${config.spread}px ${config.color}`,
  };
}

export const CalendarPreview = forwardRef<HTMLDivElement, CalendarPreviewProps>(
  function CalendarPreview(
    {
      styles,
      propertyName = 'Beach Villa',
      bookings: bookingsProp = MOCK_PREVIEW_BOOKINGS,
      blockedDays: blockedDaysProp = [],
      displayMonth,
      layoutMaxWidth,
    },
    ref
  ) {
    const storePreviewMonth = useCalendarBuilderStore((state) => state.previewMonth);
    const effectiveMonth = displayMonth ?? storePreviewMonth;
    const bookings = bookingsProp.length > 0 ? bookingsProp : MOCK_PREVIEW_BOOKINGS;
    const blockedDays = blockedDaysProp.length > 0 ? blockedDaysProp : MOCK_BLOCKED_DAYS;

    // Calendar calculations
    const calendarData = useMemo(() => {
      const year = effectiveMonth.getFullYear();
      const month = effectiveMonth.getMonth();
      const today = new Date();
      const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
      const todayDate = isCurrentMonth ? today.getDate() : -1;

      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      const firstDayWeekday = firstDayOfMonth.getDay();
      const monthDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
      const weeks = buildCalendarWeekRows(monthDays, firstDayWeekday);

      const previewCheckIn = (booking: PreviewBooking) =>
        format(new Date(year, month, booking.startDay), 'yyyy-MM-dd');
      const previewCheckOut = (booking: PreviewBooking) =>
        format(addDays(new Date(year, month, booking.endDay), 1), 'yyyy-MM-dd');

      const segmentsByWeek = buildOccupancySegmentsForWeeks(
        bookings,
        weeks,
        previewCheckIn,
        previewCheckOut
      );

      type DayCell = {
        day: number | null;
        isBooked: boolean;
        isBlocked: boolean;
        isToday: boolean;
        booking?: PreviewBooking;
      };

      const weeksWithCells = weeks.map((week) => ({
        weekIndex: week.weekIndex,
        cells: week.days.map((day): DayCell => {
          if (day.getMonth() !== month || day.getFullYear() !== year) {
            return { day: null, isBooked: false, isBlocked: false, isToday: false };
          }
          const dayNum = day.getDate();
          const booking = bookings.find((b) => dayNum >= b.startDay && dayNum <= b.endDay);
          return {
            day: dayNum,
            isBooked: !!booking,
            isBlocked: blockedDays.includes(dayNum),
            isToday: dayNum === todayDate,
            booking,
          };
        }),
      }));

      return {
        year,
        month,
        monthName: MONTH_NAMES[month],
        weeks: weeksWithCells,
        segmentsByWeek,
        todayDate,
      };
    }, [effectiveMonth, bookings, blockedDays]);

    // Format month/year
    const formatMonthYear = () => {
      const { format } = styles.header.monthYear;
      const { monthName = 'January', year, month } = calendarData;

      switch (format) {
        case 'MMMM YYYY':
          return `${monthName} ${year}`;
        case 'MMM YYYY':
          return `${monthName.substring(0, 3)} ${year}`;
        case 'MM/YYYY':
          return `${String(month + 1).padStart(2, '0')}/${year}`;
        case 'YYYY-MM':
          return `${year}-${String(month + 1).padStart(2, '0')}`;
        default:
          return `${monthName} ${year}`;
      }
    };

    const dayNameFormat = styles.dayNames.format || 'short';

    return (
      <div
        ref={ref}
        style={{
          position: 'relative',
          ...getBackgroundStyle(styles.container.background),
          ...getBorderStyle(styles.container.border),
          ...getShadowStyle(styles.container.shadow),
          ...getSpacingStyle(styles.container.padding, 'padding'),
          width: layoutMaxWidth ?? styles.container.maxWidth,
          maxWidth: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        {styles.header.show && (
          <div
            style={{
              ...getBackgroundStyle(styles.header.background),
              ...getBorderStyle(styles.header.border),
              ...getSpacingStyle(styles.header.padding, 'padding'),
            }}
          >
            {/* Property Name */}
            {styles.header.propertyName.show && (
              <p
                style={{
                  ...getFontStyle(styles.header.propertyName.font),
                  color: styles.header.propertyName.color,
                  textAlign: styles.header.title.alignment,
                  marginBottom: 4,
                }}
              >
                {propertyName}
              </p>
            )}

            {/* Title and Navigation Row */}
            <div
              className="flex items-center"
              style={{
                justifyContent: styles.header.navigation.show
                  ? 'space-between'
                  : styles.header.title.alignment === 'center'
                    ? 'center'
                    : styles.header.title.alignment === 'right'
                      ? 'flex-end'
                      : 'flex-start',
              }}
            >
              {/* Month/Year */}
              {styles.header.monthYear.show && (
                <h2
                  style={{
                    ...getFontStyle(styles.header.monthYear.font),
                    color: styles.header.monthYear.color,
                    margin: 0,
                  }}
                >
                  {formatMonthYear()}
                </h2>
              )}

              {/* Navigation Preview (visual only - actual navigation is in toolbar) */}
              {styles.header.navigation.show && (
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: styles.header.navigation.buttonSize,
                      height: styles.header.navigation.buttonSize,
                      backgroundColor: styles.header.navigation.buttonBackground,
                      color: styles.header.navigation.buttonColor,
                      ...getBorderStyle(styles.header.navigation.buttonBorder),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChevronLeft style={{ width: 16, height: 16 }} />
                  </div>
                  <div
                    style={{
                      width: styles.header.navigation.buttonSize,
                      height: styles.header.navigation.buttonSize,
                      backgroundColor: styles.header.navigation.buttonBackground,
                      color: styles.header.navigation.buttonColor,
                      ...getBorderStyle(styles.header.navigation.buttonBorder),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChevronRight style={{ width: 16, height: 16 }} />
                  </div>
                </div>
              )}
            </div>

            {/* Subtitle */}
            {styles.header.subtitle.show && styles.header.subtitle.text && (
              <p
                style={{
                  ...getFontStyle(styles.header.subtitle.font),
                  color: styles.header.subtitle.color,
                  textAlign: styles.header.title.alignment,
                  marginTop: 8,
                  margin: 0,
                }}
              >
                {styles.header.subtitle.text}
              </p>
            )}
          </div>
        )}

        {/* Day Names Header */}
        {styles.dayNames.show && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: styles.grid.gap,
              ...getBackgroundStyle(styles.dayNames.background),
              ...getBorderStyle(styles.dayNames.border),
              ...getSpacingStyle(styles.dayNames.padding, 'padding'),
              marginTop: 8,
            }}
          >
            {DAY_NAMES[dayNameFormat].map((day, index) => (
              <div
                key={index}
                style={{
                  ...getFontStyle(styles.dayNames.font),
                  color: styles.dayNames.color,
                  textAlign: styles.dayNames.alignment,
                }}
              >
                {day}
              </div>
            ))}
          </div>
        )}

        {/* Calendar Grid */}
        <div
          style={{
            ...getBackgroundStyle(styles.grid.background),
            ...getBorderStyle(styles.grid.border),
            ...getSpacingStyle(styles.grid.padding, 'padding'),
          }}
        >
          {calendarData.weeks.map((week) => (
            <div key={week.weekIndex} style={{ marginBottom: styles.grid.gap }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: styles.grid.gap,
                }}
              >
                {week.cells.map((dayData, index) => {
                  const { day, isBooked, isBlocked, isToday } = dayData;

                  // Empty cell
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${index}`}
                        style={{
                          aspectRatio: '1 / 1',
                          ...getBackgroundStyle(styles.cell.empty.background),
                          opacity: styles.cell.empty.opacity,
                          borderRadius: styles.cell.borderRadius,
                        }}
                      />
                    );
                  }

                  // Determine cell styles based on state
                  let cellBackground = styles.cell.background;
                  let cellBorder = styles.cell.border;
                  let dayNumberColor = styles.cell.dayNumber.color;
                  let textContent = null;
                  let patternOverlay = null;

                  if (isToday && styles.today.enabled) {
                    cellBackground = styles.today.background;
                    cellBorder = styles.today.border;
                    dayNumberColor = styles.today.dayNumberColor;
                  } else if (isBooked) {
                    cellBackground = styles.booked.background;
                    cellBorder = styles.booked.border;
                    dayNumberColor = styles.booked.dayNumberColor;

                    // Show icon/image if enabled, otherwise show text
                    if (styles.booked.icon.show) {
                      const iconPositionStyles: React.CSSProperties = {
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      };

                      switch (styles.booked.icon.position) {
                        case 'center':
                          iconPositionStyles.top = '50%';
                          iconPositionStyles.left = '50%';
                          iconPositionStyles.transform = 'translate(-50%, -50%)';
                          break;
                        case 'top-left':
                          iconPositionStyles.top = 8;
                          iconPositionStyles.left = 8;
                          break;
                        case 'top-right':
                          iconPositionStyles.top = 8;
                          iconPositionStyles.right = 8;
                          break;
                        case 'bottom-left':
                          iconPositionStyles.bottom = 8;
                          iconPositionStyles.left = 8;
                          break;
                        case 'bottom-right':
                          iconPositionStyles.bottom = 8;
                          iconPositionStyles.right = 8;
                          break;
                      }

                      // Icon mapping for predefined icons
                      const ICON_MAP: Record<string, string> = {
                        check: '✓',
                        x: '✕',
                        'calendar-check': '📅',
                        user: '👤',
                        bed: '🛏️',
                        house: '🏠',
                        key: '🔑',
                        lock: '🔒',
                        star: '⭐',
                        heart: '❤️',
                        ban: '🚫',
                        reserved: '📌',
                      };

                      if (styles.booked.icon.type === 'icon') {
                        textContent = (
                          <span
                            style={{
                              ...iconPositionStyles,
                              fontSize: styles.booked.icon.size,
                              color: styles.booked.icon.color,
                              opacity: styles.booked.icon.opacity,
                            }}
                          >
                            {ICON_MAP[styles.booked.icon.value] || styles.booked.icon.value}
                          </span>
                        );
                      } else if (styles.booked.icon.type === 'image' && styles.booked.icon.value) {
                        textContent = (
                          <img
                            src={styles.booked.icon.value}
                            alt="Booked"
                            style={{
                              ...iconPositionStyles,
                              width: styles.booked.icon.size,
                              height: styles.booked.icon.size,
                              objectFit: 'contain',
                              opacity: styles.booked.icon.opacity,
                            }}
                          />
                        );
                      }
                    } else if (styles.booked.text.show) {
                      textContent = (
                        <span
                          style={{
                            ...getFontStyle(styles.booked.text.font),
                            color: styles.booked.text.color,
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            ...(styles.booked.text.position === 'center' && {
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                            }),
                            ...(styles.booked.text.position === 'bottom' && { bottom: 8 }),
                            ...(styles.booked.text.position === 'top' && { top: 24 }),
                          }}
                        >
                          {styles.booked.text.content}
                        </span>
                      );
                    }

                    if (styles.booked.pattern.show && styles.booked.pattern.type !== 'none') {
                      patternOverlay = (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: styles.booked.pattern.opacity,
                            pointerEvents: 'none',
                            borderRadius: styles.cell.borderRadius,
                            ...(styles.booked.pattern.type === 'stripes' && {
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent ${styles.booked.pattern.size}px, ${styles.booked.pattern.color} ${styles.booked.pattern.size}px, ${styles.booked.pattern.color} ${styles.booked.pattern.size * 2}px)`,
                            }),
                            ...(styles.booked.pattern.type === 'diagonal' && {
                              backgroundImage: `repeating-linear-gradient(45deg, ${styles.booked.pattern.color}, ${styles.booked.pattern.color} 1px, transparent 1px, transparent ${styles.booked.pattern.size}px)`,
                            }),
                            ...(styles.booked.pattern.type === 'dots' && {
                              backgroundImage: `radial-gradient(${styles.booked.pattern.color} 1px, transparent 1px)`,
                              backgroundSize: `${styles.booked.pattern.size}px ${styles.booked.pattern.size}px`,
                            }),
                            ...(styles.booked.pattern.type === 'cross' && {
                              backgroundImage: `linear-gradient(${styles.booked.pattern.color} 1px, transparent 1px), linear-gradient(to right, ${styles.booked.pattern.color} 1px, transparent 1px)`,
                              backgroundSize: `${styles.booked.pattern.size}px ${styles.booked.pattern.size}px`,
                            }),
                          }}
                        />
                      );
                    }
                  } else if (isBlocked) {
                    cellBackground = styles.blocked.background;
                    cellBorder = styles.blocked.border;
                    dayNumberColor = styles.blocked.dayNumberColor;

                    if (styles.blocked.text.show) {
                      textContent = (
                        <span
                          style={{
                            ...getFontStyle(styles.blocked.text.font),
                            color: styles.blocked.text.color,
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          {styles.blocked.text.content}
                        </span>
                      );
                    }

                    if (styles.blocked.pattern.show && styles.blocked.pattern.type !== 'none') {
                      const blockedPatternSize = 8;
                      patternOverlay = (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: styles.blocked.pattern.opacity,
                            pointerEvents: 'none',
                            borderRadius: styles.cell.borderRadius,
                            ...(styles.blocked.pattern.type === 'stripes' && {
                              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent ${blockedPatternSize}px, ${styles.blocked.pattern.color} ${blockedPatternSize}px, ${styles.blocked.pattern.color} ${blockedPatternSize * 2}px)`,
                            }),
                            ...(styles.blocked.pattern.type === 'diagonal' && {
                              backgroundImage: `repeating-linear-gradient(45deg, ${styles.blocked.pattern.color}, ${styles.blocked.pattern.color} 1px, transparent 1px, transparent ${blockedPatternSize}px)`,
                            }),
                            ...(styles.blocked.pattern.type === 'cross' && {
                              backgroundImage: `linear-gradient(${styles.blocked.pattern.color} 1px, transparent 1px), linear-gradient(to right, ${styles.blocked.pattern.color} 1px, transparent 1px)`,
                              backgroundSize: `${blockedPatternSize}px ${blockedPatternSize}px`,
                            }),
                          }}
                        />
                      );
                    }
                  } else {
                    // Available state
                    cellBackground = styles.available.background;
                    cellBorder = styles.available.border;
                    dayNumberColor = styles.available.dayNumberColor;

                    if (styles.available.price.show) {
                      textContent = (
                        <span
                          style={{
                            ...getFontStyle(styles.available.price.font),
                            color: styles.available.price.color,
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            ...(styles.available.price.position === 'bottom' && { bottom: 8 }),
                            ...(styles.available.price.position === 'center' && {
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                            }),
                            ...(styles.available.price.position === 'top-right' && {
                              top: 8,
                              right: 8,
                              left: 'auto',
                              transform: 'none',
                            }),
                          }}
                        >
                          {styles.available.price.format === 'currency' ? '₱2,500' : '2500'}
                        </span>
                      );
                    }
                  }

                  // Day number position
                  const dayNumberPositionStyles: React.CSSProperties = {
                    position: 'absolute' as const,
                    ...getSpacingStyle(styles.cell.dayNumber.padding, 'padding'),
                  };

                  switch (styles.cell.dayNumber.position) {
                    case 'top-left':
                      dayNumberPositionStyles.top = 8;
                      dayNumberPositionStyles.left = 8;
                      break;
                    case 'top-center':
                      dayNumberPositionStyles.top = 8;
                      dayNumberPositionStyles.left = '50%';
                      dayNumberPositionStyles.transform = 'translateX(-50%)';
                      break;
                    case 'top-right':
                      dayNumberPositionStyles.top = 8;
                      dayNumberPositionStyles.right = 8;
                      break;
                    case 'center':
                      dayNumberPositionStyles.top = '50%';
                      dayNumberPositionStyles.left = '50%';
                      dayNumberPositionStyles.transform = 'translate(-50%, -50%)';
                      break;
                  }

                  return (
                    <div
                      key={day}
                      style={{
                        position: 'relative',
                        aspectRatio: '1 / 1',
                        ...getBackgroundStyle(cellBackground),
                        ...getBorderStyle(cellBorder),
                        ...getSpacingStyle(styles.cell.padding, 'padding'),
                        transition: `all ${styles.cell.hover.transition}ms`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      className="group"
                    >
                      {patternOverlay}

                      {/* Day Number */}
                      <span
                        style={{
                          ...getFontStyle(styles.cell.dayNumber.font),
                          color: dayNumberColor,
                          ...dayNumberPositionStyles,
                          ...(isToday &&
                            styles.today.dayNumberBackground && {
                              backgroundColor: styles.today.dayNumberBackground,
                              paddingTop: 2,
                              paddingRight: 6,
                              paddingBottom: 2,
                              paddingLeft: 6,
                              borderRadius: 4,
                            }),
                        }}
                      >
                        {day}
                      </span>

                      {/* Today Indicator */}
                      {isToday && styles.today.indicator.show && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            ...(styles.today.indicator.type === 'dot' && {
                              width: styles.today.indicator.size,
                              height: styles.today.indicator.size,
                              borderRadius: '50%',
                              backgroundColor: styles.today.indicator.color,
                            }),
                            ...(styles.today.indicator.type === 'underline' && {
                              width: 16,
                              height: 2,
                              backgroundColor: styles.today.indicator.color,
                            }),
                            ...(styles.today.indicator.type === 'ring' && {
                              width: styles.today.indicator.size * 2.5,
                              height: styles.today.indicator.size * 2.5,
                              borderRadius: '50%',
                              border: `2px solid ${styles.today.indicator.color}`,
                              backgroundColor: 'transparent',
                            }),
                            ...(styles.today.indicator.type === 'badge' && {
                              width: Math.max(styles.today.indicator.size * 3, 18),
                              height: styles.today.indicator.size * 1.4,
                              borderRadius: 999,
                              backgroundColor: styles.today.indicator.color,
                            }),
                          }}
                        />
                      )}

                      {textContent}
                    </div>
                  );
                })}
              </div>

              {styles.booked.guestInfo.show ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: styles.grid.gap,
                    marginTop: 4,
                    minHeight: 18,
                  }}
                >
                  {(calendarData.segmentsByWeek.get(week.weekIndex) ?? []).map((segment) => {
                    const spanPosition = calendarOccupancySpanPosition(segment);
                    const radius = styles.cell.borderRadius;
                    const borderRadius =
                      spanPosition === 'start'
                        ? `${radius}px 0 0 ${radius}px`
                        : spanPosition === 'end'
                          ? `0 ${radius}px ${radius}px 0`
                          : spanPosition === 'middle'
                            ? '0'
                            : `${radius}px`;

                    return (
                      <div
                        key={`${week.weekIndex}-${segment.item.id}-${segment.startCol}-${segment.endCol}`}
                        style={{
                          gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                          gridRow: segment.lane + 1,
                          minWidth: 0,
                          display: 'flex',
                          alignItems: 'center',
                          padding: segment.showLabel ? '2px 6px' : '2px 0',
                          borderRadius,
                          ...(segment.showLabel
                            ? {
                                ...getFontStyle(styles.booked.guestInfo.font),
                                color: styles.booked.guestInfo.color,
                                overflow: styles.booked.guestInfo.truncate ? 'hidden' : 'visible',
                                textOverflow: styles.booked.guestInfo.truncate
                                  ? 'ellipsis'
                                  : 'clip',
                                whiteSpace: 'nowrap',
                              }
                            : { opacity: 0.75 }),
                          ...(styles.booked.background.type === 'solid'
                            ? { backgroundColor: styles.booked.background.color }
                            : {}),
                          border: `${styles.booked.border.width}px ${styles.booked.border.style} ${styles.booked.border.color}`,
                        }}
                      >
                        {segment.showLabel ? segment.item.guestName : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Legend */}
        {styles.legend.show && (
          <div
            style={{
              marginTop: 16,
              ...getBackgroundStyle(styles.legend.background),
              ...getBorderStyle(styles.legend.border),
              ...getSpacingStyle(styles.legend.padding, 'padding'),
            }}
          >
            {styles.legend.title.show && (
              <h3
                style={{
                  ...getFontStyle(styles.legend.title.font),
                  color: styles.legend.title.color,
                  marginBottom: 12,
                }}
              >
                {styles.legend.title.text}
              </h3>
            )}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: styles.legend.item.gap,
              }}
            >
              {/* Available */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: styles.legend.item.indicatorSize,
                    height: styles.legend.item.indicatorSize,
                    borderRadius: styles.legend.item.indicatorBorderRadius,
                    ...getBackgroundStyle(styles.available.background),
                    ...getBorderStyle(styles.available.border),
                  }}
                />
                <span
                  style={{
                    ...getFontStyle(styles.legend.item.labelFont),
                    color: styles.legend.item.labelColor,
                  }}
                >
                  Available
                </span>
              </div>

              {/* Booked */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: styles.legend.item.indicatorSize,
                    height: styles.legend.item.indicatorSize,
                    borderRadius: styles.legend.item.indicatorBorderRadius,
                    ...getBackgroundStyle(styles.booked.background),
                    ...getBorderStyle(styles.booked.border),
                  }}
                />
                <span
                  style={{
                    ...getFontStyle(styles.legend.item.labelFont),
                    color: styles.legend.item.labelColor,
                  }}
                >
                  Booked
                </span>
              </div>

              {/* Today */}
              {styles.today.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: styles.legend.item.indicatorSize,
                      height: styles.legend.item.indicatorSize,
                      borderRadius: styles.legend.item.indicatorBorderRadius,
                      ...getBackgroundStyle(styles.today.background),
                      ...getBorderStyle(styles.today.border),
                    }}
                  />
                  <span
                    style={{
                      ...getFontStyle(styles.legend.item.labelFont),
                      color: styles.legend.item.labelColor,
                    }}
                  >
                    Today
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Watermark */}
        {styles.watermark.show && (
          <div
            style={{
              position: 'absolute',
              opacity: styles.watermark.opacity,
              color: styles.watermark.color,
              ...(styles.watermark.font && getFontStyle(styles.watermark.font)),
              fontSize: styles.watermark.size,
              pointerEvents: 'none',
              ...(styles.watermark.position === 'bottom-right' && { bottom: 16, right: 16 }),
              ...(styles.watermark.position === 'bottom-left' && { bottom: 16, left: 16 }),
              ...(styles.watermark.position === 'top-right' && { top: 16, right: 16 }),
              ...(styles.watermark.position === 'top-left' && { top: 16, left: 16 }),
              ...(styles.watermark.position === 'center' && {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }),
            }}
          >
            {styles.watermark.type === 'text' && styles.watermark.text}
            {styles.watermark.type === 'image' && styles.watermark.imageUrl && (
              <img
                src={styles.watermark.imageUrl}
                alt="Watermark"
                style={{
                  width: styles.watermark.size,
                  height: 'auto',
                  opacity: styles.watermark.opacity,
                }}
              />
            )}
          </div>
        )}
      </div>
    );
  }
);
