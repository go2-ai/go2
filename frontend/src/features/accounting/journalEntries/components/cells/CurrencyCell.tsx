import { TextField, MenuItem } from '@mui/material';
import type { AccountingCurrency } from '../../../currencies/currenciesApi';

interface CurrencyCellProps {
  value: number | null;
  currencies: AccountingCurrency[];
  disabled?: boolean;
  onChange: (currencyId: number | null) => void;
}

export const CurrencyCell = ({ value, currencies, disabled, onChange }: CurrencyCellProps) => {
  return (
    <TextField
      select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      variant="standard"
      fullWidth
      disabled={disabled}
      size="small"
      InputProps={{ disableUnderline: true }}
      sx={{
        height: '100%',
        '& .MuiInputBase-root': {
          height: '100%',
          backgroundColor: disabled ? 'action.disabledBackground' : 'transparent',
          justifyContent: 'center',
        },
        '& .MuiSelect-select': {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        },
      }}
    >
      {currencies.map((currency) => (
        <MenuItem key={currency.id} value={currency.id}>
          {currency.abr}
        </MenuItem>
      ))}
    </TextField>
  );
};