import { TextField, useTheme } from '@mui/material';
import { creditColor, debitColor } from '../../../../../theme/amountColors';
import { useCellBuffer, parseNumericText } from './useCellBuffer';

interface DebitCreditCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  decimalDigits: number;
  color: 'error' | 'primary';
  disabled?: boolean;
  error?: boolean;
  onTypingStart?: () => void;
}

const toEditText = (val: number | null): string =>
  val === null || val === undefined || val === 0 ? '' : String(val);

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

  const { isFocused, buffer, handlers, dirtyAttr } = useCellBuffer({
    value,
    toEditText,
    isValidPartial: isValidPartialNumber,
    // A literal 0 means "no value" — must not look like a real debit/credit
    // entry to the rest of the app (isCredit checks, mutual-exclusion logic).
    parse: (raw) => {
      const parsed = parseNumericText(raw);
      return parsed === 0 ? null : parsed;
    },
    onCommit: onChange,
    onTypingStart,
  });

  const colorValue = color === 'error' ? debitColor(theme) : creditColor(theme);

  return (
    <TextField
      value={isFocused ? buffer : formatNumber(value)}
      {...handlers}
      variant="standard"
      fullWidth
      disabled={disabled}
      error={error}
      sx={{ px: 1 }}
      inputProps={{
        ...dirtyAttr,
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
