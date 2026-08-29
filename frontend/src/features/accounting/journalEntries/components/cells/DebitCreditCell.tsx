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
    if (val === null || val === undefined) return '';
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

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatNumber(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimalDigits, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(value === null || value === undefined ? '' : String(value));
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