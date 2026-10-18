import { TextField } from '@mui/material';
import { useCellBuffer, parseNumericText } from './useCellBuffer';

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

const isValidPartialNumber = (raw: string): boolean => {
  if (raw === '' || raw === '-') return true;
  return /^-?\d*(\.\d*)?$/.test(raw);
};

export const RateCell = ({ value, onChange, disabled, error }: RateCellProps) => {
  const { isFocused, buffer, handlers, dirtyAttr } = useCellBuffer({
    value,
    toEditText: formatRate,
    isValidPartial: isValidPartialNumber,
    parse: parseNumericText,
    onCommit: onChange,
  });

  return (
    <TextField
      value={isFocused ? buffer : formatRate(value)}
      {...handlers}
      variant="standard"
      fullWidth
      disabled={disabled}
      error={error}
      // No hardcoded hex here — rely entirely on theme tokens so this reads
      // correctly in both light and dark mode.
      inputProps={{
        ...dirtyAttr,
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
