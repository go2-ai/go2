import { useState, useCallback, useEffect, useMemo } from 'react';
import DatePicker, { DateObject } from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
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
import { useTheme } from '@mui/material/styles';
import {
  type CalendarType,
  calendarFor,
  localeFor,
  isValidYMD,
  dateToIso,
  shiftDays,
  isoToDateObject,
  dateObjectToIso,
  formatForDisplay,
  useCalendarList,
  readCalendarPreference,
  writeCalendarPreference,
  useIsDarkMode,
} from './calendarUtils';

export type { CalendarType } from './calendarUtils';

interface BaseDatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  calendars?: CalendarType | CalendarType[];
  defaultCalendar?: CalendarType;
  identifier?: string;
  /** Controls the active calendar (e.g. pickers that share a choice). */
  calendar?: CalendarType;
  /** Called when the user switches calendars in the picker. */
  onCalendarChange?: (calendar: CalendarType) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const CalendarFooterControls = ({
  activeCalendar,
  calendarList,
  onCalendarSwitch,
  onToday,
  todayLabel,
}: {
  position?: string;
  activeCalendar: CalendarType;
  calendarList: CalendarType[];
  onCalendarSwitch: (cal: CalendarType) => void;
  onToday: () => void;
  todayLabel?: string;
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
        {todayLabel ?? t('today')}
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
  calendar: controlledCalendar,
  onCalendarChange,
  label,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'small',
}: BaseDatePickerProps) => {
  // Resolve calendar list: prop > organization config > default
  const calendarList = useCalendarList(calendars);

  // Determine initial active calendar
  const getInitialCalendar = useCallback((): CalendarType => {
    if (defaultCalendar) return defaultCalendar;

    if (identifier && calendarList.length > 1) {
      const stored = readCalendarPreference(identifier, calendarList);
      if (stored) return stored;
    }

    return calendarList[0];
  }, [defaultCalendar, identifier, calendarList]);

  const [internalCalendar, setInternalCalendar] = useState<CalendarType>(getInitialCalendar);
  const activeCalendar =
    controlledCalendar && calendarList.includes(controlledCalendar) ? controlledCalendar : internalCalendar;
  const [text, setText] = useState('');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
  const isDark = useIsDarkMode();
  const pickerClassName = `rmdp-brand${isDark ? ' bg-brand-dark' : ''}`;

  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  // Re-sync active calendar when calendarList changes
  useEffect(() => {
    if (!calendarList.includes(internalCalendar)) {
      setInternalCalendar(calendarList[0]);
    }
  }, [calendarList, internalCalendar]);

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

  const calendarPicker = calendarFor(activeCalendar);
  const localePicker = localeFor(activeCalendar);

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
      setInternalCalendar(cal);
      setText('');

      if (identifier && calendarList.length > 1) {
        writeCalendarPreference(identifier, cal);
      }
      onCalendarChange?.(cal);
    },
    [identifier, calendarList.length, onCalendarChange]
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
