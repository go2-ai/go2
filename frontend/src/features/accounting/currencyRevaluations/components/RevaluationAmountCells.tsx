import { Box, MenuItem, TextField, Tooltip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useTranslation } from 'react-i18next';
import { creditColor, debitColor } from '../../../../theme/amountColors';
import { formatRevaluationAmount } from '../revaluationFormat';


/**
 * A signed balance: positive = debit, negative = credit. Shown unsigned in
 * the journal entry debit/credit colors, with the side as tooltip/label.
 */
export const BalanceAmount = ({ value, digits }: { value: string | null; digits: number }) => {
  const { t: tAccounting } = useTranslation('accounting');
  if (value === null) return null;
  const amount = Number(value);
  if (amount === 0) return <Box component="span" sx={{ fontFamily: 'monospace' }}>{formatRevaluationAmount(0, digits)}</Box>;
  const side = amount > 0 ? tAccounting('revaluations.debitSide') : tAccounting('revaluations.creditSide');
  return (
    <Tooltip title={side} disableInteractive>
      <Box
        component="span"
        aria-label={`${formatRevaluationAmount(Math.abs(amount), digits)} ${side}`}
        sx={{ fontFamily: 'monospace', fontWeight: 600, color: (theme) => (amount > 0 ? debitColor(theme) : creditColor(theme)) }}
      >
        {formatRevaluationAmount(Math.abs(amount), digits)}
      </Box>
    </Tooltip>
  );
};

/** Revaluation difference: positive = gain (green), negative = loss (red). */
export const DifferenceAmount = ({ value, digits }: { value: string; digits: number }) => {
  const amount = Number(value);
  return (
    <Box
      component="span"
      sx={{
        fontFamily: 'monospace',
        fontWeight: amount === 0 ? 400 : 600,
        color: amount > 0 ? 'success.main' : amount < 0 ? 'error.main' : 'text.secondary',
      }}
    >
      {formatRevaluationAmount(amount, digits)}
    </Box>
  );
};

interface GainLossAccountCellProps {
  difference: string;
  value: number | null;
  options: Array<{ id: number; label: string }>;
  label: (id: number) => string;
  editable: boolean;
  error?: boolean;
  disabled?: boolean;
  onChange: (accountId: number | null) => void;
}

/** Gain/loss account of an item, marked as gain (green, up) or loss (red, down). */
export const GainLossAccountCell = ({ difference, value, options, label, editable, error, disabled, onChange }: GainLossAccountCellProps) => {
  const { t: tAccounting } = useTranslation('accounting');
  const amount = Number(difference);
  if (amount === 0) return null;
  const gain = amount > 0;
  const kindLabel = tAccounting(gain ? 'revaluations.gain' : 'revaluations.loss');
  const icon = gain
    ? <TrendingUpIcon fontSize="small" color="success" titleAccess={kindLabel} />
    : <TrendingDownIcon fontSize="small" color="error" titleAccess={kindLabel} />;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, width: '100%', height: '100%' }}>
      {icon}
      {editable ? (
        <TextField
          select
          size="small"
          variant="standard"
          fullWidth
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          error={error}
          disabled={disabled}
          inputProps={{ 'aria-label': `${tAccounting('revaluations.gainLossAccount')} (${kindLabel})` }}
          sx={{ '& .MuiInputBase-input': { color: gain ? 'success.main' : 'error.main' } }}
        >
          <MenuItem value="">—</MenuItem>
          {options.map((option) => <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>)}
        </TextField>
      ) : (
        <Box component="span" sx={{ color: gain ? 'success.main' : 'error.main', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value ? label(value) : ''}
        </Box>
      )}
    </Box>
  );
};
