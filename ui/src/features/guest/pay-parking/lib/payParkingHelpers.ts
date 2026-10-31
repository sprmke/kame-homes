import { startOfDay } from 'date-fns';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import {
  dateToString,
  getManilaYmdToday,
  getNextDay,
  stringToDate,
  toGuestSubmissionDate,
} from '@/utils/format/dates';

export type ParkingDateRange = {
  from: Date;
  to: Date;
};

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const MANILA = 'Asia/Manila';

export function parseBookingStayDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const normalized = toGuestSubmissionDate(value.trim());
  const d = dayjs(normalized, 'MM-DD-YYYY', true);
  return d.isValid() ? d.toDate() : null;
}

export function bookingDateToMmDdYyyy(date: Date): string {
  return dayjs(date).format('MM-DD-YYYY');
}

export function countParkingNights(checkInDate: string, checkOutDate: string): number {
  const from = parseBookingStayDate(checkInDate);
  const to = parseBookingStayDate(checkOutDate);
  if (!from || !to) return 1;
  const nights = dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day');
  return nights > 0 ? nights : 1;
}

export function defaultParkingDateRange(booking: {
  check_in_date: string;
  check_out_date: string;
  parking_check_in_date?: string | null;
  parking_check_out_date?: string | null;
}): ParkingDateRange {
  const from =
    parseBookingStayDate(booking.parking_check_in_date) ??
    parseBookingStayDate(booking.check_in_date);
  const to =
    parseBookingStayDate(booking.parking_check_out_date) ??
    parseBookingStayDate(booking.check_out_date);
  if (!from || !to) {
    const today = new Date();
    return { from: today, to: today };
  }
  return { from, to };
}

/** True when parking window matches the booking stay (or parking dates are unset). */
export function parkingUsesBookingStayDates(booking: {
  check_in_date: string;
  check_out_date: string;
  parking_check_in_date?: string | null;
  parking_check_out_date?: string | null;
}): boolean {
  const stayIn = toGuestSubmissionDate(booking.check_in_date);
  const stayOut = toGuestSubmissionDate(booking.check_out_date);
  const parkInRaw = booking.parking_check_in_date?.trim();
  const parkOutRaw = booking.parking_check_out_date?.trim();
  if (!parkInRaw || !parkOutRaw) return true;
  return (
    toGuestSubmissionDate(parkInRaw) === stayIn && toGuestSubmissionDate(parkOutRaw) === stayOut
  );
}

export function bookingStayDateRange(booking: {
  check_in_date: string;
  check_out_date: string;
}): ParkingDateRange {
  const from = parseBookingStayDate(booking.check_in_date);
  const to = parseBookingStayDate(booking.check_out_date);
  if (!from || !to) {
    const today = new Date();
    return { from: today, to: today };
  }
  return { from, to };
}

/** Whole-stay night count (check-out minus check-in). */
export function bookingStayNights(booking: {
  check_in_date: string;
  check_out_date: string;
}): number {
  return countParkingNights(booking.check_in_date, booking.check_out_date);
}

/** True when admin may pick a parking window shorter than the full stay. */
export function canCustomizeParkingDates(booking: {
  check_in_date: string;
  check_out_date: string;
}): boolean {
  return bookingStayNights(booking) > 1;
}

/** Guest form / modal: pick default parking check-out after check-in changes. */
export function defaultParkingCheckOutAfterCheckIn(
  checkIn: Date,
  currentCheckOut: Date | undefined,
  stayMax: Date
): Date {
  const min = startOfDay(checkIn);
  const max = startOfDay(stayMax);
  const next = stringToDate(getNextDay(dateToString(checkIn)));
  if (!currentCheckOut || currentCheckOut <= min || currentCheckOut > max) {
    return next <= max ? next : max;
  }
  return currentCheckOut;
}

function parseBookingCheckInDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = dayjs.tz(v, 'YYYY-MM-DD', MANILA);
    return d.isValid() ? d.startOf('day') : null;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) {
    const d = dayjs.tz(v, 'MM-DD-YYYY', MANILA);
    return d.isValid() ? d.startOf('day') : null;
  }
  return null;
}

/**
 * True when parking is submitted on check-in day or the calendar day before
 * (Asia/Manila), e.g. check-in May 25 → show on May 24 or May 25.
 */
export function isLastMinutePayParkingRequest(
  checkInDate: string,
  todayManilaYmd: string = getManilaYmdToday()
): boolean {
  const checkIn = parseBookingCheckInDate(checkInDate);
  if (!checkIn) return false;

  const today = dayjs.tz(todayManilaYmd, 'YYYY-MM-DD', MANILA).startOf('day');
  const dayBeforeCheckIn = checkIn.subtract(1, 'day');

  return !today.isBefore(dayBeforeCheckIn) && !today.isAfter(checkIn);
}

/**
 * hasPayParkingAvailed — guest completed the pay-parking vehicle form.
 */
export function hasPayParkingAvailed(booking: {
  need_parking?: boolean | null;
  car_plate_number?: string | null;
  car_brand_model?: string | null;
  car_color?: string | null;
}): boolean {
  return (
    booking.need_parking === true &&
    Boolean(booking.car_plate_number?.trim()) &&
    Boolean(booking.car_brand_model?.trim()) &&
    Boolean(booking.car_color?.trim())
  );
}

export function defaultParkingRateGuest(booking: {
  parking_rate_guest?: number | string | null;
}): number {
  const raw = booking.parking_rate_guest;
  if (raw != null && raw !== '') {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 400;
}
