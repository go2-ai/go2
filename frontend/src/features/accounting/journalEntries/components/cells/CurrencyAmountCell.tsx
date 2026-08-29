import { useState, useEffect } from 'react';
import { TextField, useTheme } from '@mui/material';

interface CurrencyAmountCellProps {
  value: number | null;
  decimalDigits: number;
  isCredit?: boolean;
  onChange?: (value: number | null) => void;
  disabled?: boolean;
  error?: boolean;
}

export const CurrencyAmountCell = ({
  value,
  decimalDigits,
  isCredit,
  onChange,
  disabled,
  error,
}: CurrencyAmountCellProps) => {
  const theme = useTheme();

  const isValidPartialNumber = (raw: string): boolean => {
    if (raw === '' || raw === '-') return true;
    const pattern = new RegExp(`^-?\\d*(\\.\\d{0,${decimalDigits}})?$`);
    return pattern.test(raw);
  };

  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>(
    value === null || value === undefined ? '' : String(value)
  );

  useEffect(() => {
    if (!isFocused) {
      setInputValue(value === null || value === undefined ? '' : String(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(value === null || value === undefined ? '' : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');

    if (!isValidPartialNumber(raw)) {
      return;
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

    onChange?.(parsed);
  };

  const formatDisplay = (val: number | null): string => {
    if (val === null || val === undefined) return '';
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return `${sign}${abs.toLocaleString('en-US', {
      minimumFractionDigits: decimalDigits,
      maximumFractionDigits: decimalDigits,
    })}`;
  };

  const colorValue = isCredit ? theme.palette.primary.light : theme.palette.error.main;

  return (
    <TextField
      value={isFocused ? inputValue : formatDisplay(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      variant="standard"
      fullWidth
      disabled={disabled}
      error={error}
      inputProps={{
        style: {
          textAlign: 'right',
          color: colorValue,
          fontFamily: 'monospace',
          fontWeight: value !== null && value !== undefined ? 600 : 400,
        },
      }}
      sx={{
        height: '100%',
        '& .MuiInputBase-root': {
          height: '100%',
          backgroundColor: disabled ? 'action.disabledBackground' : 'transparent',
        },
        '& .MuiInputBase-input': {
          display: 'flex',
          alignItems: 'center',
          height: '100%',
        },
      }}
      InputProps={{ disableUnderline: true }}
    />
  );
};