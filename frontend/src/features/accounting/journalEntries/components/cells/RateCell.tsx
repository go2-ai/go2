import { useState, useEffect } from 'react';
import { TextField } from '@mui/material';

interface RateCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  error?: boolean;
}

const formatRate = (val: number | null): string => {
  if (val === null || val === undefined) return '';
  return String(val);
};

export const RateCell = ({ value, onChange, disabled, error }: RateCellProps) => {
  const isValidPartialNumber = (raw: string): boolean => {
    if (raw === '' || raw === '-') return true;
    return /^-?\d*(\.\d*)?$/.test(raw);
  };

  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>(formatRate(value));

  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatRate(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(value === null || value === undefined ? '' : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!isValidPartialNumber(raw)) return;
    // Local display only — recalculation happens on blur.
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
    setInputValue(formatRate(parsed));
  };

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
      // No hardcoded hex here — rely entirely on theme tokens so this reads
      // correctly in both light and dark mode.
      inputProps={{
        style: { textAlign: 'right', fontFamily: 'monospace' },
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
          color: disabled ? 'text.disabled' : 'text.primary',
        },
      }}
      InputProps={{ disableUnderline: true }}
    />
  );
};