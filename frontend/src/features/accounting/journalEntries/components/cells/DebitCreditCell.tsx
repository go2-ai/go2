import { useState, useEffect } from 'react';
import { TextField, useTheme } from '@mui/material';

interface DebitCreditCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  decimalDigits: number;
  color: 'error' | 'primary';
  disabled?: boolean;
  error?: boolean;
  onTypingStart?: () => void;
}

export const DebitCreditCell = ({
  value,
  onChange,
  decimalDigits,
  color,
  disabled,
  error,
  onTypingStart,
}: DebitCreditCellProps) => {
  const theme = useTheme();

  const formatNumber = (val: number | null): string => {
    if (val === null || val === undefined || val === 0) return '';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: decimalDigits,
      maximumFractionDigits: decimalDigits,
    });
  };

  const isValidPartialNumber = (raw: string): boolean => {
    if (raw === '' || raw === '-') return true;
    const pattern = new RegExp(`^-?\\d*(\\.\\d{0,${decimalDigits}})?$`);
    return pattern.test(raw);
  };

  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>(formatNumber(value));

  // Sync the local buffer with the outside `value` whenever it changes,
  // even while focused. Typing never changes `value` itself (that only
  // happens on blur via onChange), so this can't clobber what the user is
  // mid-typing — it only kicks in for *external* updates, e.g. F10 (swap
  // debit/credit) or F8 (balance), which previously got silently reverted
  // the moment the field lost focus because this effect used to skip
  // syncing while isFocused was true.
  useEffect(() => {
    if (isFocused) {
      setInputValue(value === null || value === undefined || value === 0 ? '' : String(value));
    } else {
      setInputValue(formatNumber(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimalDigits, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    setInputValue(value === null || value === undefined || value === 0 ? '' : String(value));
    const input = e.target;
    requestAnimationFrame(() => input.select());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isValidPartialNumber(raw)) return;

    if (raw !== '') {
      onTypingStart?.();
    }

    setInputValue(raw);
  };

  const handleBlur = () => {
    setIsFocused(false);

    let parsed: number | null = null;
    if (inputValue !== '' && inputValue !== '-') {
      const num = parseFloat(inputValue);
      parsed = isNaN(num) ? null : num;
    }
    // A literal 0 means "no value" — must not look like a real debit/credit
    // entry to the rest of the app (isCredit checks, mutual-exclusion logic).
    if (parsed === 0) parsed = null;

    onChange(parsed);
    setInputValue(formatNumber(parsed));
  };

  const colorValue = color === 'error' ? theme.palette.error.main : theme.palette.primary.light;

  return (
    <TextField
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      variant="standard"
      fullWidth
      disabled={disabled}
      error={error}
      sx={{ px: 1 }}
      inputProps={{
        style: {
          textAlign: 'right',
          color: colorValue,
          fontFamily: 'monospace',
          fontWeight: value !== null && value !== undefined ? 600 : 400,
        },
      }}
      InputProps={{ disableUnderline: true }}
    />
  );
};