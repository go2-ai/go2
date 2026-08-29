import { useState, useMemo, useCallback, useEffect } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import type { Calendar, Locale } from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import persian_fa from 'react-date-object/locales/persian_fa';
import '../../styles/rmdp-brand.css';
import '../../styles/rmdp-bg-brand-dark.css';
import {
  TextField,
  InputAdornment,
  IconButton,
  Box,
  Chip,
  Button,
  Stack,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { useTheme } from '@mui/material/styles';

export type CalendarType = 'gregorian' | 'shamsi';

interface BaseDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  calendars?: CalendarType | CalendarType[];
  defaultCalendar?: CalendarType;
  identifier?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

const CALENDAR_STORAGE_KEY = 'calendar_preference';

const isValidYMD = (y: number, m: number, d: number): boolean => {
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
};

const isoToDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const dateToIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const shiftDays = (iso: string, days: number): string => {
  const date = isoToDate(iso);
  date.setDate(date.getDate() + days);
  return dateToIso(date);
};

const isoToDateObject = (iso: string, calendar: CalendarType): DateObject => {
  const date = isoToDate(iso);
  const dateObject = new DateObject(date);
  dateObject.setCalendar(calendar === 'shamsi' ? persian : gregorian);
  return dateObject;
};

const dateObjectToIso = (dateObject: DateObject): string => {
  const date = dateObject.toDate();
  return dateToIso(date);
};

const formatForDisplay = (iso: string, calendar: CalendarType): string => {
  const dateObject = isoToDateObject(iso, calendar);
  const y = String(dateObject.year);
  const m = String(dateObject.month.number).padStart(2, '0');
  const d = String(dateObject.day).padStart(2, '0');
  const separator = calendar === 'shamsi' ? '/' : '-';
  return `${y}${separator}${m}${separator}${d}`;
};

const useIsDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

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

const CalendarFooterControls = ({
  activeCalendar,
  calendarList,
  onCalendarSwitch,
  onToday,
}: {
  position?: string;
  activeCalendar: CalendarType;
  calendarList: CalendarType[];
  onCalendarSwitch: (cal: CalendarType) => void;
  onToday: () => void;
}) => {
  const { t } = useTranslation('shared');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        borderTop: '1px solid',
        borderColor: 'divider',
        flexWrap: 'wrap',
      }}
    >
      {calendarList.length > 1 && (
        <Stack direction="row" spacing={0.5} sx={{ mx: 0.5 }}>
          {calendarList.map((cal) => (
            <Chip
              key={cal}
              label={cal === 'gregorian' ? 'Gregorian' : 'Shamsi'}
              size="small"
              variant="outlined"
              color={activeCalendar === cal ? 'primary' : 'default'}
              onClick={() => onCalendarSwitch(cal)}
              sx={{ cursor: 'pointer', borderRadius: 0.4 }}
            />
          ))}
        </Stack>
      )}
      {calendarList.length === 1 && <Box />}

      <Button
        size="small"
        onClick={onToday}
        variant="text"
        color="primary"
        sx={{ textTransform: 'none' }}
      >
        {t('today')}
      </Button>
    </Box>
  );
};

export const BaseDatePicker = ({
  value,
  onChange,
  calendars,
  defaultCalendar,
  identifier,
  label,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'small',
}: BaseDatePickerProps) => {
  const currentOrganization = useSelector(
    (state: RootState) => state.organizations.currentOrganization
  );

  // Resolve calendar list: prop > organization config > default
  const calendarList = useMemo(() => {
    if (calendars) {
      return Array.isArray(calendars) ? calendars : [calendars];
    }

    const orgCalendarTypes = currentOrganization?.calendar_types;
    if (orgCalendarTypes && orgCalendarTypes.length > 0) {
      return orgCalendarTypes.filter(
        (cal): cal is CalendarType => cal === 'gregorian' || cal === 'shamsi'
      );
    }

    return ['gregorian'] as CalendarType[];
  }, [calendars, currentOrganization]);

  // Determine initial active calendar
  const getInitialCalendar = useCallback((): CalendarType => {
    if (defaultCalendar) return defaultCalendar;

    if (identifier && calendarList.length > 1) {
      try {
        const stored = localStorage.getItem(`${CALENDAR_STORAGE_KEY}:${identifier}`);
        if (stored && calendarList.includes(stored as CalendarType)) {
          return stored as CalendarType;
        }
      } catch {
        // localStorage may be unavailable
      }
    }

    return calendarList[0];
  }, [defaultCalendar, identifier, calendarList]);

  const [activeCalendar, setActiveCalendar] = useState<CalendarType>(getInitialCalendar);
  const [text, setText] = useState('');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
  const isDark = useIsDarkMode();
  const pickerClassName = `rmdp-brand${isDark ? ' bg-brand-dark' : ''}`;

  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  // Re-sync active calendar when calendarList changes
  useEffect(() => {
    if (!calendarList.includes(activeCalendar)) {
      setActiveCalendar(calendarList[0]);
    }
  }, [calendarList, activeCalendar]);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (value) {
      setText(formatForDisplay(value, activeCalendar));
    } else {
      setText('');
    }
  }, [value, activeCalendar]);

  const dateObject = useMemo(() => {
    if (!value) return null;
    try {
      return isoToDateObject(value, activeCalendar);
    } catch {
      return null;
    }
  }, [value, activeCalendar]);

  const calendarPicker: Calendar =
    activeCalendar === 'shamsi' ? persian : gregorian;

  const localePicker: Locale =
    activeCalendar === 'shamsi' ? persian_fa : gregorian_en;

  const applyDigits = useCallback(
    (digits: string) => {
      setText(digits);

      if (digits.length === 8) {
        const y = parseInt(digits.slice(0, 4), 10);
        const m = parseInt(digits.slice(4, 6), 10);
        const d = parseInt(digits.slice(6, 8), 10);

        if (activeCalendar === 'gregorian') {
          if (isValidYMD(y, m, d)) {
            onChange(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
            return;
          }
        } else {
          const dateObject = new DateObject({
            year: y,
            month: m,
            day: d,
            calendar: persian,
          });
          if (dateObject.isValid) {
            onChange(dateObjectToIso(dateObject));
            return;
          }
        }
      }

      onChange(null);
    },
    [activeCalendar, onChange]
  );

  const handleTextInput = useCallback(
    (raw: string) => {
      applyDigits(raw.replace(/\D/g, '').slice(0, 8));
    },
    [applyDigits]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!value || disabled) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(shiftDays(value, 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(shiftDays(value, -1));
      }
    },
    [value, disabled, onChange]
  );

  const handlePickerChange = useCallback(
    (date: DateObject | DateObject[] | null) => {
      if (!date) {
        setText('');
        onChange(null);
        return;
      }

      const d = Array.isArray(date) ? date[0] : date;
      if (d) {
        onChange(dateObjectToIso(d));
      }
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setText('');
    onChange(null);
  }, [onChange]);

  const handleCalendarSwitch = useCallback(
    (cal: CalendarType) => {
      setActiveCalendar(cal);
      setText('');

      if (identifier && calendarList.length > 1) {
        try {
          localStorage.setItem(`${CALENDAR_STORAGE_KEY}:${identifier}`, cal);
        } catch {
          // localStorage may be unavailable
        }
      }
    },
    [identifier, calendarList.length]
  );

  const handleToday = useCallback(() => {
    onChange(dateToIso(new Date()));
  }, [onChange]);

  return (
    <Box>
      <DatePicker
        value={dateObject}
        onChange={handlePickerChange}
        calendar={calendarPicker}
        locale={localePicker}
        editable={false}
        format="YYYY-MM-DD"
        calendarPosition="bottom-left"
        disabled={disabled}
        className={pickerClassName}
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
            onToday={handleToday}
          />,
        ]}
        render={(_, openCalendar) => (
          <TextField
            label={label}
            value={text}
            onChange={(e) => handleTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            fullWidth={fullWidth}
            size={size}
            error={error}
            helperText={helperText}
            disabled={disabled}
            required={required}
            dir={isRtl ? "rtl" : "ltr"}
            placeholder={activeCalendar === 'shamsi' ? 'YYYY/MM/DD' : 'YYYY-MM-DD'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    disabled={disabled}
                    sx={{ visibility: value ? 'visible' : 'hidden' }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={openCalendar} disabled={disabled}>
                    <CalendarMonthIcon fontSize="small" color="action" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}
      />
    </Box>
  );
};