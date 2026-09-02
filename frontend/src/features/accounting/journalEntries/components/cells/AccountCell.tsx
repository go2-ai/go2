import { useState, useEffect, useMemo } from 'react';
import { TextField, Autocomplete, Box, type AutocompleteInputChangeReason } from '@mui/material';
import type { Account } from '../../../accounts/accountsApi';

interface AccountCellProps {
  value: number | null;
  accounts: Account[];
  onChange: (accountId: number | null) => void;
  disabled?: boolean;
  error?: boolean;
}

const getAccountCode = (account: Account): string => {
  return account.full_code || account.code;
};

export const AccountCell = ({ value, accounts, onChange, disabled, error }: AccountCellProps) => {
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === value) ?? null,
    [accounts, value]
  );

  const [inputValue, setInputValue] = useState(
    selectedAccount ? getAccountCode(selectedAccount) : ''
  );

  useEffect(() => {
    setInputValue(selectedAccount ? getAccountCode(selectedAccount) : '');
  }, [selectedAccount]);

  const handleInputChange = (newValue: string, reason: AutocompleteInputChangeReason) => {
    setInputValue(newValue);

    // Only auto-resolve while the user is actively typing.
    // 'reset' = an option was picked (text is already correct)
    // 'clear' = the field was cleared
    // 'blur'  = focus left the field — don't force-resolve here, the match
    //           (if any) should already have happened during 'input'
    if (reason !== 'input') return;

    const codeMatch = accounts.find(a => getAccountCode(a) === newValue.trim());
    if (codeMatch) {
      onChange(codeMatch.id);
    }
  };

  return (
    <Autocomplete
      options={accounts}
      getOptionLabel={getAccountCode}
      value={selectedAccount}
      onChange={(_, newValue) => onChange(newValue?.id ?? null)}
      inputValue={inputValue}
      onInputChange={(_, newValue, reason) => handleInputChange(newValue, reason)}
      disabled={disabled}
      isOptionEqualToValue={(option, value) => option.id === value?.id}
      size="small"
      fullWidth
      sx={{ pl: 0.5 }}
      slotProps={{
        popper: {
          sx: {
            '& .MuiAutocomplete-listbox': {
              minWidth: 350,  // Or any width you want
            },
          },
        },
        paper: {
          sx: {
            minWidth: 350,  // Ensure the paper itself is also wide enough
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant="standard"
          error={error}
          InputProps={{
            ...params.InputProps,
            disableUnderline: true,
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <li key={key} {...optionProps}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 80 }}>
                {getAccountCode(option)}
              </span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {option.name}
              </span>
            </Box>
          </li>
        );
      }}
    />
  );
};