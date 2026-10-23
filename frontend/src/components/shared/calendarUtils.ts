// Shared by the date and month pickers, and by anything that needs months or
// quarters in the calendar the user picked (Gregorian or Shamsi). Dates are
// passed around as ISO (Gregorian) YYYY-MM-DD strings.
import { useEffect, useMemo, useState } from 'react';
import { DateObject } from 'react-multi-date-picker';
import type { Calendar, Locale } from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import persian_fa from 'react-date-object/locales/persian_fa';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';

export type CalendarType = 'gregorian' | 'shamsi';

export const CALENDAR_STORAGE_KEY = 'calendar_preference';

export const calendarFor = (calendar: CalendarType): Calendar =>
  calendar === 'shamsi' ? persian : gregorian;

export const localeFor = (calendar: CalendarType): Locale =>
  calendar === 'shamsi' ? persian_fa : gregorian_en;

export const isValidYMD = (y: number, m: number, d: number): boolean => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const isoToDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const dateToIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayIso = (): string => dateToIso(new Date());

export const shiftDays = (iso: string, days: number): string => {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToIso(date);
};

export const isoToDateObject = (iso: string, calendar: CalendarType): DateObject => {
  const dateObject = new DateObject(isoToDate(iso));
  dateObject.setCalendar(calendarFor(calendar));
  return dateObject;
};

export const dateObjectToIso = (dateObject: DateObject): string => dateToIso(dateObject.toDate());

export const formatForDisplay = (iso: string, calendar: CalendarType): string => {
  const dateObject = isoToDateObject(iso, calendar);
  const y = String(dateObject.year);
  const m = String(dateObject.month.number).padStart(2, '0');
  const d = String(dateObject.day).padStart(2, '0');
  const separator = calendar === 'shamsi' ? '/' : '-';
  return `${y}${separator}${m}${separator}${d}`;
};

/** "YYYY/MM" (Shamsi) or "YYYY-MM" (Gregorian) of the month containing iso. */
export const formatMonthForDisplay = (iso: string, calendar: CalendarType): string => {
  const dateObject = isoToDateObject(iso, calendar);
  const m = String(dateObject.month.number).padStart(2, '0');
  return calendar === 'shamsi' ? `${dateObject.year}/${m}` : `${dateObject.year}-${m}`;
};

// ── Months and quarters in a calendar ────────────────────────────────────

export const startOfMonth = (iso: string, calendar: CalendarType): string =>
  dateObjectToIso(isoToDateObject(iso, calendar).toFirstOfMonth());

export const endOfMonth = (iso: string, calendar: CalendarType): string =>
  dateObjectToIso(isoToDateObject(iso, calendar).toLastOfMonth());

/** First day of the month `months` months away from the one containing iso. */
export const addMonths = (iso: string, calendar: CalendarType, months: number): string => {
  const dateObject = isoToDateObject(iso, calendar).toFirstOfMonth();
  if (months > 0) dateObject.add(months, 'months');
  if (months < 0) dateObject.subtract(-months, 'months');
  return dateObjectToIso(dateObject);
};

/** First day of the calendar quarter (months 1–3, 4–6, …) containing iso. */
export const startOfQuarter = (iso: string, calendar: CalendarType): string => {
  const month = isoToDateObject(iso, calendar).month.number;
  return addMonths(iso, calendar, -((month - 1) % 3));
};

export const endOfQuarter = (iso: string, calendar: CalendarType): string =>
  endOfMonth(addMonths(startOfQuarter(iso, calendar), calendar, 2), calendar);

// ── Calendar choice ──────────────────────────────────────────────────────

/** The calendars to offer: the prop, else the organization's, else Gregorian. */
export const useCalendarList = (calendars?: CalendarType | CalendarType[]): CalendarType[] => {
  const currentOrganization = useSelector((state: RootState) => state.organizations.currentOrganization);

  return useMemo(() => {
    if (calendars) return Array.isArray(calendars) ? calendars : [calendars];

    const orgCalendarTypes = currentOrganization?.calendar_types;
    if (orgCalendarTypes && orgCalendarTypes.length > 0) {
      const list = orgCalendarTypes.filter(
        (cal): cal is CalendarType => cal === 'gregorian' || cal === 'shamsi'
      );
      if (list.length > 0) return list;
    }

    return ['gregorian'] as CalendarType[];
  }, [calendars, currentOrganization]);
};

export const readCalendarPreference = (identifier: string, calendarList: CalendarType[]): CalendarType | null => {
  try {
    const stored = localStorage.getItem(`${CALENDAR_STORAGE_KEY}:${identifier}`);
    return stored && calendarList.includes(stored as CalendarType) ? (stored as CalendarType) : null;
  } catch {
    return null; // localStorage may be unavailable
  }
};

export const writeCalendarPreference = (identifier: string, calendar: CalendarType) => {
  try {
    localStorage.setItem(`${CALENDAR_STORAGE_KEY}:${identifier}`, calendar);
  } catch {
    // localStorage may be unavailable
  }
};

/**
 * The active calendar for a set of pickers that share `identifier`, remembered
 * like a single picker's choice. Falls back to the first offered calendar.
 */
export const useCalendarPreference = (identifier: string, calendars?: CalendarType | CalendarType[]) => {
  const calendarList = useCalendarList(calendars);
  const [stored, setStored] = useState<CalendarType | null>(() => readCalendarPreference(identifier, calendarList));
  const calendar = stored && calendarList.includes(stored) ? stored : calendarList[0];

  const setCalendar = (next: CalendarType) => {
    setStored(next);
    writeCalendarPreference(identifier, next);
  };

  return { calendar, calendarList, setCalendar };
};

export const useIsDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(target.classList.contains('dark'));
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};
