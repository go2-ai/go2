import { TextField, useTheme } from '@mui/material';
import { creditColor, debitColor } from '../../../../../theme/amountColors';
import { useCellBuffer, parseNumericText } from './useCellBuffer';

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

  const { isFocused, buffer, handlers, dirtyAttr } = useCellBuffer({
    value,
    toEditText: (val) => (val === null || val === undefined ? '' : String(val)),
    isValidPartial: isValidPartialNumber,
    parse: parseNumericText,
    onCommit: (parsed) => onChange?.(parsed),
  });

  const formatDisplay = (val: number | null): string => {
    if (val === null || val === undefined) return '';
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    return `${sign}${abs.toLocaleString('en-US', {
      minimumFractionDigits: decimalDigits,
      maximumFractionDigits: decimalDigits,
    })}`;
  };

  const colorValue = isCredit ? creditColor(theme) : debitColor(theme);

  return (
    <TextField
      value={isFocused ? buffer : formatDisplay(value)}
      {...handlers}
      variant="standard"
      fullWidth
      disabled={disabled}
      error={error}
      inputProps={{
        ...dirtyAttr,
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