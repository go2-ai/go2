import { useCallback, useEffect, useMemo, useState } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import '../../styles/rmdp-brand.css';
import '../../styles/rmdp-bg-brand-dark.css';
import { TextField, InputAdornment, IconButton, Box } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { CalendarFooterControls } from './BaseDatePicker';
import {
  type CalendarType,
  calendarFor,
  localeFor,
  dateObjectToIso,
  endOfMonth,
  formatMonthForDisplay,
  isoToDateObject,
  startOfMonth,
  todayIso,
  useCalendarList,
  readCalendarPreference,
  writeCalendarPreference,
  useIsDarkMode,
} from './calendarUtils';

interface BaseMonthPickerProps {
  /** Any ISO date in the selected month. */
  value: string | null;
  /**
   * Called with the first (edge "start") or last (edge "end") day of the
   * picked month, in the active calendar, as an ISO date.
   */
  onChange: (value: string) => void;
  edge: 'start' | 'end';
  calendars?: CalendarType | CalendarType[];
  identifier?: string;
  /** Controls the active calendar (e.g. pickers that share a choice). */
  calendar?: CalendarType;
  onCalendarChange?: (calendar: CalendarType) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/** Picks a month (Gregorian or Shamsi), returning its first or last day. */
export const BaseMonthPicker = ({
  value,
  onChange,
  edge,
  calendars,
  identifier,
  calendar: controlledCalendar,
  onCalendarChange,
  label,
  error = false,
  helperText,
  disabled = false,
  fullWidth = true,
  size = 'small',
}: BaseMonthPickerProps) => {
  const { t } = useTranslation('shared');
  const calendarList = useCalendarList(calendars);
  const [internalCalendar, setInternalCalendar] = useState<CalendarType>(
    () => (identifier && readCalendarPreference(identifier, calendarList)) || calendarList[0]
  );
  const activeCalendar =
    controlledCalendar && calendarList.includes(controlledCalendar) ? controlledCalendar : internalCalendar;

  const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
  const isDark = useIsDarkMode();
  const isRtl = useTheme().direction === 'rtl';

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!calendarList.includes(internalCalendar)) setInternalCalendar(calendarList[0]);
  }, [calendarList, internalCalendar]);

  const dateObject = useMemo(() => {
    if (!value) return null;
    try {
      return isoToDateObject(value, activeCalendar);
    } catch {
      return null;
    }
  }, [value, activeCalendar]);

  const emit = useCallback(
    (iso: string) => onChange(edge === 'start' ? startOfMonth(iso, activeCalendar) : endOfMonth(iso, activeCalendar)),
    [edge, activeCalendar, onChange]
  );

  const handlePickerChange = useCallback(
    (date: DateObject | DateObject[] | null) => {
      const picked = Array.isArray(date) ? date[0] : date;
      if (picked) emit(dateObjectToIso(picked));
    },
    [emit]
  );

  const handleCalendarSwitch = useCallback(
    (cal: CalendarType) => {
      setInternalCalendar(cal);
      if (identifier && calendarList.length > 1) writeCalendarPreference(identifier, cal);
      onCalendarChange?.(cal);
    },
    [identifier, calendarList.length, onCalendarChange]
  );

  return (
    <Box>
      <DatePicker
        onlyMonthPicker
        value={dateObject}
        onChange={handlePickerChange}
        calendar={calendarFor(activeCalendar)}
        locale={localeFor(activeCalendar)}
        calendarPosition="bottom-left"
        disabled={disabled}
        className={`rmdp-brand${isDark ? ' bg-brand-dark' : ''}`}
        portal
        portalTarget={portalTarget}
        zIndex={99999}
        currentDate={dateObject ?? undefined}
        plugins={[
          <CalendarFooterControls
            key="calendar-controls"
            position="bottom"
            activeCalendar={activeCalendar}
            calendarList={calendarList}
            onCalendarSwitch={handleCalendarSwitch}
            onToday={() => emit(todayIso())}
            todayLabel={t('thisMonth', { defaultValue: 'This month' })}
          />,
        ]}
        render={(_, openCalendar) => (
          <TextField
            label={label}
            value={value ? formatMonthForDisplay(value, activeCalendar) : ''}
            onClick={disabled ? undefined : openCalendar}
            fullWidth={fullWidth}
            size={size}
            error={error}
            helperText={helperText}
            disabled={disabled}
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={activeCalendar === 'shamsi' ? 'YYYY/MM' : 'YYYY-MM'}
            slotProps={{
              htmlInput: { readOnly: true, style: { cursor: disabled ? 'default' : 'pointer' } },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={openCalendar} disabled={disabled}>
                      <CalendarMonthIcon fontSize="small" color="action" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />
    </Box>
  );
};
